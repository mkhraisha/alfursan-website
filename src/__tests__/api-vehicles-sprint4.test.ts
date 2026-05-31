import { vi, describe, it, expect, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../lib/supabase-admin");
vi.mock("../lib/request-user");
vi.mock("../lib/audit");

import { getAdminClient } from "../lib/supabase-admin";
import { getRequestUser } from "../lib/request-user";
import type { RequestUser } from "../lib/request-user";

import { GET as expensesGET, POST as expensesPOST } from "../pages/api/vehicles/[vin]/expenses/index";
import { DELETE as expenseDELETE } from "../pages/api/vehicles/[vin]/expenses/[expenseId]";
import { GET as docsGET, POST as docsPOST } from "../pages/api/vehicles/[vin]/documents/index";
import { DELETE as docDELETE } from "../pages/api/vehicles/[vin]/documents/[docId]";
import { PATCH as commissionPATCH } from "../pages/api/vehicles/[vin]/commission";
import { POST as uploadUrlPOST } from "../pages/api/vehicles/upload-url";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN_USER: RequestUser = { email: "admin@example.com", role: "manager", userId: "user-1" };
const SALES_USER: RequestUser = { email: "sales@example.com", role: "sales", userId: "user-2" };
const TEST_VIN = "1HGCM82633A004352";

const EXPENSE = {
  id: "exp-1",
  category: "repair",
  description: "Fix brakes",
  amount: 500,
  receipt_file_path: null,
  created_at: "2026-05-01T00:00:00Z",
};

const DOC = {
  id: "doc-1",
  document_type: "safety_inspection",
  file_path: "vehicles/VIN/docs/safety.pdf",
  description: null,
  uploaded_by: "user-1",
  created_at: "2026-05-01T00:00:00Z",
};

// ── Request builder ───────────────────────────────────────────────────────────

function req(url: string, method = "GET", body?: unknown) {
  return new Request(`https://alfursanauto.ca${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// ── beforeEach: reset mocks ───────────────────────────────────────────────────

beforeEach(() => {
  (getRequestUser as Mock).mockResolvedValue(null);
});

// ── GET /api/vehicles/:vin/expenses ───────────────────────────────────────────

describe("GET /api/vehicles/:vin/expenses", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await expensesGET({ params: { vin: TEST_VIN }, request: req(`/api/vehicles/${TEST_VIN}/expenses`) } as never);
    expect(res.status).toBe(401);
  });

  it("returns expense list for authenticated user", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const orderFn  = vi.fn().mockResolvedValue({ data: [EXPENSE], error: null });
    const eqFn     = vi.fn().mockReturnValue({ order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    (getAdminClient as Mock).mockReturnValue({ from: () => ({ select: selectFn }) });

    const res  = await expensesGET({ params: { vin: TEST_VIN }, request: req(`/api/vehicles/${TEST_VIN}/expenses`) } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].category).toBe("repair");
  });
});

// ── POST /api/vehicles/:vin/expenses ─────────────────────────────────────────

describe("POST /api/vehicles/:vin/expenses", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await expensesPOST({ params: { vin: TEST_VIN }, request: req(`/api/vehicles/${TEST_VIN}/expenses`, "POST", { category: "repair", description: "Fix", amount: 100 }) } as never);
    expect(res.status).toBe(401);
  });

  it("returns 422 when amount is 0", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    (getAdminClient as Mock).mockReturnValue({});

    const res = await expensesPOST({ params: { vin: TEST_VIN }, request: req(`/api/vehicles/${TEST_VIN}/expenses`, "POST", { category: "repair", description: "Fix", amount: 0 }) } as never);
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid category", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    (getAdminClient as Mock).mockReturnValue({});

    const res = await expensesPOST({ params: { vin: TEST_VIN }, request: req(`/api/vehicles/${TEST_VIN}/expenses`, "POST", { category: "fuel", description: "Fuel", amount: 100 }) } as never);
    expect(res.status).toBe(422);
  });

  it("returns 201 on valid expense", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const singleFn = vi.fn().mockResolvedValue({ data: EXPENSE, error: null });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const insertFn = vi.fn().mockReturnValue({ select: selectFn });
    (getAdminClient as Mock).mockReturnValue({ from: () => ({ insert: insertFn }) });

    const res = await expensesPOST({ params: { vin: TEST_VIN }, request: req(`/api/vehicles/${TEST_VIN}/expenses`, "POST", { category: "repair", description: "Fix brakes", amount: 500 }) } as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.amount).toBe(500);
  });
});

// ── DELETE /api/vehicles/:vin/expenses/:expenseId ─────────────────────────────

describe("DELETE /api/vehicles/:vin/expenses/:expenseId", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await expenseDELETE({ params: { vin: TEST_VIN, expenseId: "exp-1" }, request: req(`/api/vehicles/${TEST_VIN}/expenses/exp-1`, "DELETE") } as never);
    expect(res.status).toBe(401);
  });

  it("returns 404 when expense not found", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const singleFn = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const eqVinFn  = vi.fn().mockReturnValue({ single: singleFn });
    const eqIdFn   = vi.fn().mockReturnValue({ eq: eqVinFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqIdFn });
    (getAdminClient as Mock).mockReturnValue({ from: () => ({ select: selectFn }) });

    const res = await expenseDELETE({ params: { vin: TEST_VIN, expenseId: "missing" }, request: req(`/api/vehicles/${TEST_VIN}/expenses/missing`, "DELETE") } as never);
    expect(res.status).toBe(404);
  });

  it("returns 204 on successful delete", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);

    const existingFn = vi.fn().mockResolvedValue({ data: { id: "exp-1" }, error: null });
    const eqVinFn    = vi.fn().mockReturnValue({ single: existingFn });
    const eqIdFn     = vi.fn().mockReturnValue({ eq: eqVinFn });
    const selectFn   = vi.fn().mockReturnValue({ eq: eqIdFn });

    const deleteEqFn = vi.fn().mockResolvedValue({ error: null });
    const deleteFn   = vi.fn().mockReturnValue({ eq: deleteEqFn });

    (getAdminClient as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: selectFn, delete: deleteFn }),
    });

    const res = await expenseDELETE({ params: { vin: TEST_VIN, expenseId: "exp-1" }, request: req(`/api/vehicles/${TEST_VIN}/expenses/exp-1`, "DELETE") } as never);
    expect(res.status).toBe(204);
  });
});

// ── GET /api/vehicles/:vin/documents ─────────────────────────────────────────

describe("GET /api/vehicles/:vin/documents", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await docsGET({ params: { vin: TEST_VIN }, request: req(`/api/vehicles/${TEST_VIN}/documents`) } as never);
    expect(res.status).toBe(401);
  });

  it("returns document list for authenticated user", async () => {
    (getRequestUser as Mock).mockResolvedValue(SALES_USER);
    const orderFn  = vi.fn().mockResolvedValue({ data: [DOC], error: null });
    const eqFn     = vi.fn().mockReturnValue({ order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    (getAdminClient as Mock).mockReturnValue({ from: () => ({ select: selectFn }) });

    const res  = await docsGET({ params: { vin: TEST_VIN }, request: req(`/api/vehicles/${TEST_VIN}/documents`) } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].document_type).toBe("safety_inspection");
  });
});

// ── POST /api/vehicles/:vin/documents ─────────────────────────────────────────

describe("POST /api/vehicles/:vin/documents", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await docsPOST({ params: { vin: TEST_VIN }, request: req(`/api/vehicles/${TEST_VIN}/documents`, "POST", { document_type: "safety", file_path: "path/to/doc.pdf" }) } as never);
    expect(res.status).toBe(401);
  });

  it("returns 422 when file_path is empty", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    (getAdminClient as Mock).mockReturnValue({});

    const res = await docsPOST({ params: { vin: TEST_VIN }, request: req(`/api/vehicles/${TEST_VIN}/documents`, "POST", { document_type: "safety", file_path: "" }) } as never);
    expect(res.status).toBe(422);
  });

  it("returns 201 on valid document", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const singleFn = vi.fn().mockResolvedValue({ data: DOC, error: null });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const insertFn = vi.fn().mockReturnValue({ select: selectFn });
    (getAdminClient as Mock).mockReturnValue({ from: () => ({ insert: insertFn }) });

    const res = await docsPOST({ params: { vin: TEST_VIN }, request: req(`/api/vehicles/${TEST_VIN}/documents`, "POST", { document_type: "safety_inspection", file_path: "vehicles/VIN/docs/safety.pdf" }) } as never);
    expect(res.status).toBe(201);
  });
});

// ── DELETE /api/vehicles/:vin/documents/:docId ────────────────────────────────

describe("DELETE /api/vehicles/:vin/documents/:docId", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await docDELETE({ params: { vin: TEST_VIN, docId: "doc-1" }, request: req(`/api/vehicles/${TEST_VIN}/documents/doc-1`, "DELETE") } as never);
    expect(res.status).toBe(401);
  });

  it("returns 404 when document not found", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const singleFn = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const eqVinFn  = vi.fn().mockReturnValue({ single: singleFn });
    const eqIdFn   = vi.fn().mockReturnValue({ eq: eqVinFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqIdFn });
    (getAdminClient as Mock).mockReturnValue({ from: () => ({ select: selectFn }) });

    const res = await docDELETE({ params: { vin: TEST_VIN, docId: "missing" }, request: req(`/api/vehicles/${TEST_VIN}/documents/missing`, "DELETE") } as never);
    expect(res.status).toBe(404);
  });

  it("returns 204 on successful delete", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);

    const existingFn = vi.fn().mockResolvedValue({ data: { id: "doc-1" }, error: null });
    const eqVinFn    = vi.fn().mockReturnValue({ single: existingFn });
    const eqIdFn     = vi.fn().mockReturnValue({ eq: eqVinFn });
    const selectFn   = vi.fn().mockReturnValue({ eq: eqIdFn });

    const deleteEqFn = vi.fn().mockResolvedValue({ error: null });
    const deleteFn   = vi.fn().mockReturnValue({ eq: deleteEqFn });

    (getAdminClient as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: selectFn, delete: deleteFn }),
    });

    const res = await docDELETE({ params: { vin: TEST_VIN, docId: "doc-1" }, request: req(`/api/vehicles/${TEST_VIN}/documents/doc-1`, "DELETE") } as never);
    expect(res.status).toBe(204);
  });
});

// ── PATCH /api/vehicles/:vin/commission ───────────────────────────────────────

describe("PATCH /api/vehicles/:vin/commission", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await commissionPATCH({ params: { vin: TEST_VIN }, request: req(`/api/vehicles/${TEST_VIN}/commission`, "PATCH", { commission_user_id: null }) } as never);
    expect(res.status).toBe(401);
  });

  it("returns 422 for non-UUID commission_user_id", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    (getAdminClient as Mock).mockReturnValue({});

    const res = await commissionPATCH({ params: { vin: TEST_VIN }, request: req(`/api/vehicles/${TEST_VIN}/commission`, "PATCH", { commission_user_id: "not-a-uuid" }) } as never);
    expect(res.status).toBe(422);
  });

  it("clears commission when commission_user_id is null", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);

    // update vehicle
    const updateSingleFn = vi.fn().mockResolvedValue({ data: { vin: TEST_VIN, purchase_price: 10000, advertised_price_cargurus: 14000, sale_price: null }, error: null });
    const updateSelectFn = vi.fn().mockReturnValue({ single: updateSingleFn });
    const updateEqFn     = vi.fn().mockReturnValue({ select: updateSelectFn });
    const updateFn       = vi.fn().mockReturnValue({ eq: updateEqFn });

    // expenses
    const expEqFn  = vi.fn().mockResolvedValue({ data: [], error: null });
    const expSelFn = vi.fn().mockReturnValue({ eq: expEqFn });

    (getAdminClient as Mock).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "vehicles")         return { update: updateFn };
        if (table === "vehicle_expenses") return { select: expSelFn };
        return {};
      }),
    });

    const res = await commissionPATCH({ params: { vin: TEST_VIN }, request: req(`/api/vehicles/${TEST_VIN}/commission`, "PATCH", { commission_user_id: null }) } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.commission_user_id).toBeNull();
    expect(body.commission).toBeNull();
  });

  it("returns 422 when assigning a disabled user", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const profileSingleFn = vi.fn().mockResolvedValue({ data: { id: "user-2", is_active: false, commission_percentage: 0.1 }, error: null });
    const profileEqFn     = vi.fn().mockReturnValue({ single: profileSingleFn });
    const profileSelFn    = vi.fn().mockReturnValue({ eq: profileEqFn });
    (getAdminClient as Mock).mockReturnValue({ from: () => ({ select: profileSelFn }) });

    const res = await commissionPATCH({ params: { vin: TEST_VIN }, request: req(`/api/vehicles/${TEST_VIN}/commission`, "PATCH", { commission_user_id: "123e4567-e89b-12d3-a456-426614174000" }) } as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/disabled/i);
  });
});

// ── POST /api/vehicles/upload-url ─────────────────────────────────────────────

describe("POST /api/vehicles/upload-url", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await uploadUrlPOST({ request: req("/api/vehicles/upload-url", "POST", { context: "vehicle-image", vin: TEST_VIN, contentType: "image/jpeg", fileSize: 1000 }) } as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid VIN", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    (getAdminClient as Mock).mockReturnValue({});

    const res = await uploadUrlPOST({ request: req("/api/vehicles/upload-url", "POST", { context: "vehicle-image", vin: "BADVIN", contentType: "image/jpeg", fileSize: 1000 }) } as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid context", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    (getAdminClient as Mock).mockReturnValue({});

    const res = await uploadUrlPOST({ request: req("/api/vehicles/upload-url", "POST", { context: "random-thing", vin: TEST_VIN, contentType: "image/jpeg", fileSize: 1000 }) } as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when file exceeds 50 MiB", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    (getAdminClient as Mock).mockReturnValue({});

    const res = await uploadUrlPOST({ request: req("/api/vehicles/upload-url", "POST", { context: "vehicle-image", vin: TEST_VIN, contentType: "image/jpeg", fileSize: 60 * 1024 * 1024 }) } as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when content type not allowed for context", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    (getAdminClient as Mock).mockReturnValue({});

    // PDF is allowed for vehicle-document but not a wrong type
    const res = await uploadUrlPOST({ request: req("/api/vehicles/upload-url", "POST", { context: "vehicle-document", vin: TEST_VIN, contentType: "video/mp4", fileSize: 1000 }) } as never);
    expect(res.status).toBe(400);
  });

  it("returns signed URL for valid vehicle-image request", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const signedUrlFn = vi.fn().mockResolvedValue({ data: { signedUrl: "https://storage.example.com/signed" }, error: null });
    (getAdminClient as Mock).mockReturnValue({
      storage: { from: () => ({ createSignedUploadUrl: signedUrlFn }) },
    });

    const res = await uploadUrlPOST({ request: req("/api/vehicles/upload-url", "POST", { context: "vehicle-image", vin: TEST_VIN, contentType: "image/jpeg", fileSize: 1000 }) } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uploadUrl).toBeDefined();
    expect(body.bucket).toBe("vehicle-images");
    expect(body.storagePath).toContain(`vehicles/${TEST_VIN}/`);
  });

  it("returns signed URL for valid vehicle-document request", async () => {
    (getRequestUser as Mock).mockResolvedValue(SALES_USER);
    const signedUrlFn = vi.fn().mockResolvedValue({ data: { signedUrl: "https://storage.example.com/signed" }, error: null });
    (getAdminClient as Mock).mockReturnValue({
      storage: { from: () => ({ createSignedUploadUrl: signedUrlFn }) },
    });

    const res = await uploadUrlPOST({ request: req("/api/vehicles/upload-url", "POST", { context: "vehicle-document", vin: TEST_VIN, contentType: "application/pdf", fileSize: 500000 }) } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bucket).toBe("vehicle-documents");
    expect(body.storagePath).toContain(`vehicles/${TEST_VIN}/docs/`);
  });
});
