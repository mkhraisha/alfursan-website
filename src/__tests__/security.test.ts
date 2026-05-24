import { vi, describe, it, expect, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../lib/supabase-admin");
vi.mock("../lib/request-user");
vi.mock("../lib/audit");

import { getAdminClient } from "../lib/supabase-admin";
import { getRequestUser } from "../lib/request-user";
import type { RequestUser } from "../lib/request-user";

import { GET as vehiclesGET, POST as vehiclesPOST } from "../pages/api/vehicles/index";
import { PATCH as vinPATCH, DELETE as vinDELETE } from "../pages/api/vehicles/[vin]/index";
import { POST as importPOST } from "../pages/api/vehicles/import";
import { POST as expensesPOST } from "../pages/api/vehicles/[vin]/expenses/index";
import { DELETE as expenseDELETE } from "../pages/api/vehicles/[vin]/expenses/[expenseId]";
import { POST as docsPOST } from "../pages/api/vehicles/[vin]/documents/index";
import { DELETE as docDELETE } from "../pages/api/vehicles/[vin]/documents/[docId]";
import { PATCH as commissionPATCH } from "../pages/api/vehicles/[vin]/commission";
import { POST as uploadUrlPOST } from "../pages/api/vehicles/upload-url";
import { GET as usersGET, POST as usersPOST } from "../pages/api/dealer/users";
import { PATCH as userPATCH } from "../pages/api/dealer/users/[userId]";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SALES_USER: RequestUser = { email: "sales@test.com", role: "sales", userId: "sales-uuid-1" };
const VIN = "1HGCM82633A004352";

function jsonReq(url: string, method = "POST", body?: unknown) {
  return new Request(`https://alfursanauto.ca${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function importReq() {
  const fd = new FormData();
  fd.append("file", new Blob(["VIN,Make\n" + VIN + ",Honda"], { type: "text/csv" }), "import.csv");
  fd.append("mapping", JSON.stringify({ VIN: "vin", Make: "make" }));
  return new Request("https://alfursanauto.ca/api/vehicles/import", { method: "POST", body: fd });
}

beforeEach(() => {
  vi.clearAllMocks();
  (getRequestUser as Mock).mockResolvedValue(null);
  (getAdminClient as Mock).mockReturnValue({ from: vi.fn().mockReturnValue({}) });
});

// ── 401 — all write endpoints require authentication ──────────────────────────

describe("401 — all write endpoints reject unauthenticated requests", () => {
  const cases: [string, () => Promise<Response>][] = [
    [
      "POST /api/vehicles",
      () => vehiclesPOST({ request: jsonReq("/api/vehicles", "POST", {}) } as never),
    ],
    [
      "PATCH /api/vehicles/:vin",
      () => vinPATCH({ params: { vin: VIN }, request: jsonReq(`/api/vehicles/${VIN}`, "PATCH", {}) } as never),
    ],
    [
      "DELETE /api/vehicles/:vin",
      () => vinDELETE({ params: { vin: VIN }, request: jsonReq(`/api/vehicles/${VIN}`, "DELETE") } as never),
    ],
    [
      "POST /api/vehicles/import",
      () => importPOST({ request: importReq() } as never),
    ],
    [
      "POST /api/vehicles/:vin/expenses",
      () => expensesPOST({ params: { vin: VIN }, request: jsonReq(`/api/vehicles/${VIN}/expenses`, "POST", {}) } as never),
    ],
    [
      "DELETE /api/vehicles/:vin/expenses/:expenseId",
      () => expenseDELETE({ params: { vin: VIN, expenseId: "exp-1" }, request: jsonReq(`/api/vehicles/${VIN}/expenses/exp-1`, "DELETE") } as never),
    ],
    [
      "POST /api/vehicles/:vin/documents",
      () => docsPOST({ params: { vin: VIN }, request: jsonReq(`/api/vehicles/${VIN}/documents`, "POST", {}) } as never),
    ],
    [
      "DELETE /api/vehicles/:vin/documents/:docId",
      () => docDELETE({ params: { vin: VIN, docId: "doc-1" }, request: jsonReq(`/api/vehicles/${VIN}/documents/doc-1`, "DELETE") } as never),
    ],
    [
      "PATCH /api/vehicles/:vin/commission",
      () => commissionPATCH({ params: { vin: VIN }, request: jsonReq(`/api/vehicles/${VIN}/commission`, "PATCH", {}) } as never),
    ],
    [
      "POST /api/vehicles/upload-url",
      () => uploadUrlPOST({ request: jsonReq("/api/vehicles/upload-url", "POST", {}) } as never),
    ],
    [
      "GET /api/dealer/users",
      () => usersGET({ request: jsonReq("/api/dealer/users", "GET") } as never),
    ],
    [
      "POST /api/dealer/users",
      () => usersPOST({ request: jsonReq("/api/dealer/users", "POST", {}) } as never),
    ],
    [
      "PATCH /api/dealer/users/:userId",
      () => userPATCH({ params: { userId: "user-1" }, request: jsonReq("/api/dealer/users/user-1", "PATCH", {}) } as never),
    ],
  ];

  it.each(cases)("%s → 401", async (_, handler) => {
    const res = await handler();
    expect(res.status).toBe(401);
  });
});

// ── 403 — admin-only endpoints reject the sales role ─────────────────────────

describe("403 — admin-only endpoints reject the sales role", () => {
  beforeEach(() => {
    (getRequestUser as Mock).mockResolvedValue(SALES_USER);
  });

  const cases: [string, () => Promise<Response>][] = [
    [
      "DELETE /api/vehicles/:vin",
      () => vinDELETE({ params: { vin: VIN }, request: jsonReq(`/api/vehicles/${VIN}`, "DELETE") } as never),
    ],
    [
      "GET /api/dealer/users",
      () => usersGET({ request: jsonReq("/api/dealer/users", "GET") } as never),
    ],
    [
      "POST /api/dealer/users",
      () => usersPOST({ request: jsonReq("/api/dealer/users", "POST", {}) } as never),
    ],
    [
      "PATCH /api/dealer/users/:userId",
      () => userPATCH({ params: { userId: "user-1" }, request: jsonReq("/api/dealer/users/user-1", "PATCH", {}) } as never),
    ],
  ];

  it.each(cases)("%s → 403 for sales role", async (_, handler) => {
    const res = await handler();
    expect(res.status).toBe(403);
  });
});

// ── Public field filtering — GET /api/vehicles ────────────────────────────────

describe("GET /api/vehicles — unauthenticated response excludes private fields", () => {
  it("does not include purchase_price, sale_price, or commission_user_id in the public response", async () => {
    // Simulate what Supabase returns when queried with PUBLIC_COLUMNS only
    const publicRow = {
      vin: VIN,
      make: "Honda",
      model: "Civic",
      trim: null,
      series: null,
      year: 2020,
      colour: "Blue",
      odometer: 50_000,
      advertised_price_cargurus: 14_000,
      images_json: [],
      videos_json: [],
      carfax_link: null,
    };

    const rangeFn    = vi.fn().mockResolvedValue({ data: [publicRow], error: null, count: 1 });
    const orderFn    = vi.fn().mockReturnValue({ range: rangeFn });
    const selectFn   = vi.fn().mockReturnValue({ order: orderFn });
    (getAdminClient as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: selectFn }),
    });

    const res = await vehiclesGET({ request: jsonReq("/api/vehicles", "GET") } as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    const row = body.data[0];

    // Private fields must be absent
    expect(row).not.toHaveProperty("purchase_price");
    expect(row).not.toHaveProperty("sale_price");
    expect(row).not.toHaveProperty("commission_user_id");
    expect(row).not.toHaveProperty("internal_notes");
    expect(row).not.toHaveProperty("expense_total");
    expect(row).not.toHaveProperty("total_cost");
    expect(row).not.toHaveProperty("profit_loss");

    // Public fields must be present
    expect(row).toHaveProperty("vin");
    expect(row).toHaveProperty("make");
    expect(row).toHaveProperty("advertised_price_cargurus");
    expect(row).toHaveProperty("images_json");
  });
});
