import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

// ── Module mocks (hoisted before imports) ─────────────────────────────────────
vi.mock("../lib/supabase-admin");
vi.mock("../lib/request-user");
vi.mock("../lib/audit");

import { getAdminClient } from "../lib/supabase-admin";
import { getRequestUser } from "../lib/request-user";
import type { RequestUser } from "../lib/request-user";
import { GET as vehiclesGET, POST as vehiclesPOST } from "../pages/api/vehicles/index";
import { GET as vinGET, PATCH as vinPATCH, DELETE as vinDELETE } from "../pages/api/vehicles/[vin]/index";
import { POST as importPOST } from "../pages/api/vehicles/import";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN_USER: RequestUser = { email: "admin@example.com", role: "admin", userId: "user-1" };
const SALES_USER: RequestUser = { email: "sales@example.com", role: "sales", userId: "user-2" };

const VEHICLE = {
  vin:  "1HGCM82633A004352",
  make: "Honda",
  model: "Civic",
  year: 2020,
  colour: "Blue",
  purchase_price: 10_000,
  advertised_price_cargurus: 14_000,
  sale_price: null,
  sale_date: null,
  ownership_status: "available",
  status: "frontline_ready",
  photography_status: "done",
  images_json: [],
  videos_json: [],
  carfax_link: null,
  commission_user_id: null,
  commission_user: null,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

// ── Mock builders ─────────────────────────────────────────────────────────────

/** Build a Supabase mock chain that resolves GET /api/vehicles (list + expenses) */
function makeListMock(vehicles = [VEHICLE], expenses: {vin: string; amount: number}[] = []) {
  const rangeFn   = vi.fn().mockResolvedValue({ data: vehicles, error: null, count: vehicles.length });
  const orderFn   = vi.fn().mockReturnValue({ range: rangeFn });
  const selectListFn = vi.fn().mockReturnValue({ order: orderFn });

  const inFn      = vi.fn().mockResolvedValue({ data: expenses, error: null });
  const selectExpFn = vi.fn().mockReturnValue({ in: inFn });

  const fromFn = vi.fn((table: string) => {
    if (table === "vehicles")         return { select: selectListFn };
    if (table === "vehicle_expenses") return { select: selectExpFn };
    return {};
  });

  return { client: { from: fromFn } };
}

/** Build a Supabase mock for GET single vehicle */
function makeSingleMock(vehicle: Record<string, unknown> | null, expenses: {amount: number}[] = []) {
  const singleFn  = vi.fn().mockResolvedValue({ data: vehicle, error: vehicle ? null : { code: "PGRST116" } });
  const eqVinFn   = vi.fn().mockReturnValue({ single: singleFn });
  const selectFn  = vi.fn().mockReturnValue({ eq: eqVinFn });

  // For expenses sub-query: from("vehicle_expenses").select("amount").eq("vin", vin) → resolves
  const expEqFn     = vi.fn().mockResolvedValue({ data: expenses, error: null });
  const expSelectFn = vi.fn().mockReturnValue({ eq: expEqFn });

  const fromFn = vi.fn((table: string) => {
    if (table === "vehicles")         return { select: selectFn };
    if (table === "vehicle_expenses") return { select: expSelectFn };
    return {};
  });

  return { client: { from: fromFn } };
}

/** Build a Supabase mock for POST /api/vehicles (insert) */
function makeInsertMock(data: Record<string, unknown> | null, error: {code?: string; message?: string} | null = null) {
  const singleFn = vi.fn().mockResolvedValue({ data, error });
  const selectFn = vi.fn().mockReturnValue({ single: singleFn });
  const insertFn = vi.fn().mockReturnValue({ select: selectFn });
  const fromFn   = vi.fn().mockReturnValue({ insert: insertFn });
  return { client: { from: fromFn }, insertFn };
}

/** Build a Supabase mock for PATCH /api/vehicles/[vin] */
function makeUpdateMock(data: Record<string, unknown> | null, error: {code?: string} | null = null) {
  const singleFn  = vi.fn().mockResolvedValue({ data, error });
  const selectFn  = vi.fn().mockReturnValue({ single: singleFn });
  const eqFn      = vi.fn().mockReturnValue({ select: selectFn });
  const updateFn  = vi.fn().mockReturnValue({ eq: eqFn });

  const expEqFn   = vi.fn().mockResolvedValue({ data: [], error: null });
  const expSelFn  = vi.fn().mockReturnValue({ eq: expEqFn });

  const fromFn = vi.fn((table: string) => {
    if (table === "vehicles")         return { update: updateFn };
    if (table === "vehicle_expenses") return { select: expSelFn };
    return {};
  });

  return { client: { from: fromFn } };
}

/** Build a Supabase mock for DELETE /api/vehicles/[vin] */
function makeDeleteMock(error: null | { code: string } = null) {
  const eqFn     = vi.fn().mockResolvedValue({ error });
  const deleteFn = vi.fn().mockReturnValue({ eq: eqFn });
  const fromFn   = vi.fn().mockReturnValue({ delete: deleteFn });
  return { client: { from: fromFn } };
}

// ── Helper to build requests ──────────────────────────────────────────────────

function req(
  url: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {}
) {
  return new Request(`https://alfursanauto.ca${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  (getRequestUser as Mock).mockResolvedValue(null); // default: unauthenticated
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/vehicles ─────────────────────────────────────────────────────────

describe("GET /api/vehicles — unauthenticated", () => {
  it("returns 200 with public fields and cache header", async () => {
    const { client } = makeListMock();
    (getAdminClient as Mock).mockReturnValue(client);

    const res = await vehiclesGET({ request: req("/api/vehicles") } as never);

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("max-age=300");
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it("does not include expense_total or computed fields for public requests", async () => {
    const { client } = makeListMock();
    (getAdminClient as Mock).mockReturnValue(client);

    const res = await vehiclesGET({ request: req("/api/vehicles") } as never);
    const body = await res.json();
    // Public response is the raw Supabase row — no server-side enrichment
    expect(body.data[0]).not.toHaveProperty("expense_total");
  });
});

describe("GET /api/vehicles — authenticated", () => {
  it("returns enriched data with expense_total, total_cost, profit_loss, commission", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const { client } = makeListMock(
      [VEHICLE],
      [{ vin: VEHICLE.vin, amount: 1_500 }]
    );
    (getAdminClient as Mock).mockReturnValue(client);

    const res = await vehiclesGET({ request: req("/api/vehicles") } as never);

    expect(res.status).toBe(200);
    const body = await res.json();
    const v = body.data[0];
    expect(v.expense_total).toBe(1_500);
    expect(v.total_cost).toBe(11_500);    // 10_000 + 1_500
    expect(v.profit_loss).toBe(2_500);    // 14_000 - 11_500 (no sale_price → uses advertised)
    expect(v.commission).toBeNull();      // no commission user set
  });

  it("returns empty data array when no vehicles exist", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const { client } = makeListMock([]);
    (getAdminClient as Mock).mockReturnValue(client);

    const res = await vehiclesGET({ request: req("/api/vehicles") } as never);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});

// ── POST /api/vehicles ────────────────────────────────────────────────────────

describe("POST /api/vehicles", () => {
  const VALID_BODY = {
    vin:  "1HGCM82633A004352",
    make: "Honda",
    model: "Civic",
    year: 2020,
  };

  it("returns 401 when unauthenticated", async () => {
    const res = await vehiclesPOST({ request: req("/api/vehicles", "POST", VALID_BODY) } as never);
    expect(res.status).toBe(401);
  });

  it("returns 201 and vehicle on success", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const { client } = makeInsertMock(VEHICLE);
    (getAdminClient as Mock).mockReturnValue(client);

    const res = await vehiclesPOST({ request: req("/api/vehicles", "POST", VALID_BODY) } as never);
    expect(res.status).toBe(201);
  });

  it("returns 409 on duplicate VIN", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const { client } = makeInsertMock(null, { code: "23505" });
    (getAdminClient as Mock).mockReturnValue(client);

    const res = await vehiclesPOST({ request: req("/api/vehicles", "POST", VALID_BODY) } as never);
    expect(res.status).toBe(409);
  });

  it("returns 422 when VIN is missing", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const { vin: _, ...noVin } = VALID_BODY;

    const res = await vehiclesPOST({ request: req("/api/vehicles", "POST", noVin) } as never);
    expect(res.status).toBe(422);
  });

  it("returns 422 when VIN is invalid format", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);

    const res = await vehiclesPOST({
      request: req("/api/vehicles", "POST", { ...VALID_BODY, vin: "TOOSHORT" }),
    } as never);
    expect(res.status).toBe(422);
  });

  it("returns 422 when price is negative", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);

    const res = await vehiclesPOST({
      request: req("/api/vehicles", "POST", { ...VALID_BODY, purchase_price: -100 }),
    } as never);
    expect(res.status).toBe(422);
  });

  it("returns 403 when sales role tries to… wait, sales CAN create vehicles", async () => {
    (getRequestUser as Mock).mockResolvedValue(SALES_USER);
    const { client } = makeInsertMock(VEHICLE);
    (getAdminClient as Mock).mockReturnValue(client);

    const res = await vehiclesPOST({ request: req("/api/vehicles", "POST", VALID_BODY) } as never);
    expect(res.status).toBe(201);
  });
});

// ── GET /api/vehicles/:vin ────────────────────────────────────────────────────

describe("GET /api/vehicles/:vin", () => {
  it("returns 404 for unknown VIN (unauthenticated)", async () => {
    const { client } = makeSingleMock(null);
    (getAdminClient as Mock).mockReturnValue(client);

    const res = await vinGET({ params: { vin: "UNKNOWNVIN000001A" }, request: req("/api/vehicles/UNKNOWNVIN000001A") } as never);
    expect(res.status).toBe(404);
  });

  it("returns vehicle for unauthenticated request", async () => {
    const { client } = makeSingleMock(VEHICLE);
    (getAdminClient as Mock).mockReturnValue(client);

    const res = await vinGET({ params: { vin: VEHICLE.vin }, request: req(`/api/vehicles/${VEHICLE.vin}`) } as never);
    expect(res.status).toBe(200);
  });

  it("returns enriched vehicle for authenticated request", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const { client } = makeSingleMock(VEHICLE, [{ amount: 500 }]);
    (getAdminClient as Mock).mockReturnValue(client);

    const res = await vinGET({ params: { vin: VEHICLE.vin }, request: req(`/api/vehicles/${VEHICLE.vin}`) } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expense_total).toBe(500);
    expect(body.total_cost).toBe(10_500);
  });
});

// ── PATCH /api/vehicles/:vin ──────────────────────────────────────────────────

describe("PATCH /api/vehicles/:vin", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await vinPATCH({
      params: { vin: VEHICLE.vin },
      request: req(`/api/vehicles/${VEHICLE.vin}`, "PATCH", { colour: "Red" }),
    } as never);
    expect(res.status).toBe(401);
  });

  it("returns 200 on successful update", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const { client } = makeUpdateMock({ ...VEHICLE, colour: "Red" });
    (getAdminClient as Mock).mockReturnValue(client);

    const res = await vinPATCH({
      params: { vin: VEHICLE.vin },
      request: req(`/api/vehicles/${VEHICLE.vin}`, "PATCH", { colour: "Red" }),
    } as never);
    expect(res.status).toBe(200);
  });

  it("returns 404 when vehicle not found", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const { client } = makeUpdateMock(null, { code: "PGRST116" });
    (getAdminClient as Mock).mockReturnValue(client);

    const res = await vinPATCH({
      params: { vin: VEHICLE.vin },
      request: req(`/api/vehicles/${VEHICLE.vin}`, "PATCH", { colour: "Red" }),
    } as never);
    expect(res.status).toBe(404);
  });

  it("returns 422 for invalid field value (negative price)", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);

    const res = await vinPATCH({
      params: { vin: VEHICLE.vin },
      request: req(`/api/vehicles/${VEHICLE.vin}`, "PATCH", { advertised_price_cargurus: -50 }),
    } as never);
    expect(res.status).toBe(422);
  });
});

// ── DELETE /api/vehicles/:vin ─────────────────────────────────────────────────

describe("DELETE /api/vehicles/:vin", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await vinDELETE({
      params: { vin: VEHICLE.vin },
      request: req(`/api/vehicles/${VEHICLE.vin}`, "DELETE"),
    } as never);
    expect(res.status).toBe(401);
  });

  it("returns 403 for sales role (cannot delete)", async () => {
    (getRequestUser as Mock).mockResolvedValue(SALES_USER);

    const res = await vinDELETE({
      params: { vin: VEHICLE.vin },
      request: req(`/api/vehicles/${VEHICLE.vin}`, "DELETE"),
    } as never);
    expect(res.status).toBe(403);
  });

  it("returns 204 on successful delete", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const { client } = makeDeleteMock(null);
    (getAdminClient as Mock).mockReturnValue(client);

    const res = await vinDELETE({
      params: { vin: VEHICLE.vin },
      request: req(`/api/vehicles/${VEHICLE.vin}`, "DELETE"),
    } as never);
    expect(res.status).toBe(204);
  });
});

// ── POST /api/vehicles/import ─────────────────────────────────────────────────

describe("POST /api/vehicles/import", () => {
  const VALID_CSV = [
    "VIN,Make,Model,Year",
    "1HGCM82633A004352,Honda,Civic,2020",
  ].join("\n");

  const MAPPING = JSON.stringify({ VIN: "vin", Make: "make", Model: "model", Year: "year" });

  function makeImportFormData(csv: string, mapping = MAPPING, preview = false) {
    const fd = new FormData();
    fd.append("file", new Blob([csv], { type: "text/csv" }), "import.csv");
    fd.append("mapping", mapping);
    if (preview) fd.append("preview", "true");
    return fd;
  }

  it("returns 401 when unauthenticated", async () => {
    const request = new Request("https://alfursanauto.ca/api/vehicles/import", {
      method: "POST",
      body: makeImportFormData(VALID_CSV),
    });
    const res = await importPOST({ request } as never);
    expect(res.status).toBe(401);
  });

  it("returns preview rows without inserting when preview=true", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);

    const request = new Request("https://alfursanauto.ca/api/vehicles/import", {
      method: "POST",
      body: makeImportFormData(VALID_CSV, MAPPING, true),
    });
    const res = await importPOST({ request } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("preview");
    expect(body.valid_count).toBe(1);
  });

  it("inserts valid rows and returns created count", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const insertEqFn = vi.fn().mockResolvedValue({ error: null });
    const insertFn   = vi.fn().mockReturnValue({ error: null });
    const fromFn = vi.fn().mockReturnValue({ insert: insertFn });
    // Direct insert mock (not chained with select/single for import)
    (getAdminClient as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const request = new Request("https://alfursanauto.ca/api/vehicles/import", {
      method: "POST",
      body: makeImportFormData(VALID_CSV),
    });
    const res = await importPOST({ request } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(1);
    expect(body.failed).toBe(0);
  });

  it("skips duplicate VINs and reports in errors array", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    (getAdminClient as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: { code: "23505" } }),
      }),
    });

    const request = new Request("https://alfursanauto.ca/api/vehicles/import", {
      method: "POST",
      body: makeImportFormData(VALID_CSV),
    });
    const res = await importPOST({ request } as never);
    const body = await res.json();
    expect(body.created).toBe(0);
    expect(body.failed).toBe(1);
    expect(body.errors[0].error).toContain("Duplicate");
  });

  it("reports validation errors for rows missing required fields", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const badCsv = ["VIN,Make,Model,Year", ",Honda,Civic,2020"].join("\n"); // empty VIN

    const request = new Request("https://alfursanauto.ca/api/vehicles/import", {
      method: "POST",
      body: makeImportFormData(badCsv),
    });
    const res = await importPOST({ request } as never);
    const body = await res.json();
    expect(body.created).toBe(0);
    expect(body.failed).toBe(1);
    expect(body.errors[0].row).toBe(2);
  });

  it("returns 400 for missing file field", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const fd = new FormData();
    fd.append("mapping", MAPPING);

    const request = new Request("https://alfursanauto.ca/api/vehicles/import", {
      method: "POST",
      body: fd,
    });
    const res = await importPOST({ request } as never);
    expect(res.status).toBe(400);
  });
});
