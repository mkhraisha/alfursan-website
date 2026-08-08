import { vi, describe, it, expect, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../lib/supabase-admin");
vi.mock("../lib/request-user");
vi.mock("../lib/audit");

import { getAdminClient } from "../lib/supabase-admin";
import { getRequestUser } from "../lib/request-user";
import type { RequestUser } from "../lib/request-user";

import { GET as businessGET, POST as businessPOST } from "../pages/api/expenses/business/index";
import { PATCH as businessPATCH, DELETE as businessDELETE } from "../pages/api/expenses/business/[expenseId]";
import { POST as uploadUrlPOST } from "../pages/api/expenses/upload-url";

const MANAGER_USER: RequestUser = { email: "manager@example.com", role: "manager", userId: "user-1" };
const SALES_USER: RequestUser = { email: "sales@example.com", role: "sales", userId: "user-2" };

const BUSINESS_EXPENSE = {
  id: "be-1",
  category: "gas",
  vendor: "Petro Canada",
  description: "Fuel",
  amount: 100,
  expense_date: "2026-07-25",
  tax_amount: 13,
  tax_type: "HST_ON",
  tax_rate: 0.13,
  receipt_file_path: "business-expenses/abc.pdf",
  created_at: "2026-07-25T00:00:00Z",
  updated_at: "2026-07-25T00:00:00Z",
};

function req(url: string, method = "GET", body?: unknown) {
  return new Request(`https://alfursanauto.ca${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  (getRequestUser as Mock).mockResolvedValue(null);
});

describe("GET /api/expenses/business", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await businessGET({ request: req("/api/expenses/business") } as never);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-manager roles", async () => {
    (getRequestUser as Mock).mockResolvedValue(SALES_USER);
    const res = await businessGET({ request: req("/api/expenses/business") } as never);
    expect(res.status).toBe(403);
  });

  it("returns expense list for manager/owner", async () => {
    (getRequestUser as Mock).mockResolvedValue(MANAGER_USER);
    const order2 = vi.fn().mockResolvedValue({ data: [BUSINESS_EXPENSE], error: null });
    const order1 = vi.fn().mockReturnValue({ order: order2 });
    const select = vi.fn().mockReturnValue({ order: order1 });
    (getAdminClient as Mock).mockReturnValue({ from: () => ({ select }) });

    const res = await businessGET({ request: req("/api/expenses/business") } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].category).toBe("gas");
  });
});

describe("POST /api/expenses/business", () => {
  it("returns 403 for non-manager roles", async () => {
    (getRequestUser as Mock).mockResolvedValue(SALES_USER);
    const res = await businessPOST({
      request: req("/api/expenses/business", "POST", { category: "gas", description: "Fuel", amount: 100, expense_date: "2026-07-25" }),
    } as never);
    expect(res.status).toBe(403);
  });

  it("returns 201 on valid payload", async () => {
    (getRequestUser as Mock).mockResolvedValue(MANAGER_USER);
    const single = vi.fn().mockResolvedValue({ data: BUSINESS_EXPENSE, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    (getAdminClient as Mock).mockReturnValue({ from: () => ({ insert }) });

    const res = await businessPOST({
      request: req("/api/expenses/business", "POST", {
        category: "gas",
        description: "Fuel",
        amount: 100,
        expense_date: "2026-07-25",
        receipt_file_path: "business-expenses/abc.pdf",
      }),
    } as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.receipt_file_path).toContain("business-expenses/");
  });
});

function mockUpdateSingle(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const eq     = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  (getAdminClient as Mock).mockReturnValue({ from: () => ({ update }) });
}

describe("PATCH /api/expenses/business/:expenseId", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await businessPATCH({
      params: { expenseId: "be-1" },
      request: req("/api/expenses/business/be-1", "PATCH", { amount: 200 }),
    } as never);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-manager roles", async () => {
    (getRequestUser as Mock).mockResolvedValue(SALES_USER);
    const res = await businessPATCH({
      params: { expenseId: "be-1" },
      request: req("/api/expenses/business/be-1", "PATCH", { amount: 200 }),
    } as never);
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid JSON body", async () => {
    (getRequestUser as Mock).mockResolvedValue(MANAGER_USER);
    const request = new Request("https://alfursanauto.ca/api/expenses/business/be-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });
    const res = await businessPATCH({ params: { expenseId: "be-1" }, request } as never);
    expect(res.status).toBe(400);
  });

  it("returns 422 when no fields are provided", async () => {
    (getRequestUser as Mock).mockResolvedValue(MANAGER_USER);
    (getAdminClient as Mock).mockReturnValue({});

    const res = await businessPATCH({
      params: { expenseId: "be-1" },
      request: req("/api/expenses/business/be-1", "PATCH", {}),
    } as never);
    expect(res.status).toBe(422);
  });

  it("returns 422 when tax_rate doesn't match tax_type", async () => {
    (getRequestUser as Mock).mockResolvedValue(MANAGER_USER);
    (getAdminClient as Mock).mockReturnValue({});

    const res = await businessPATCH({
      params: { expenseId: "be-1" },
      request: req("/api/expenses/business/be-1", "PATCH", { tax_type: "HST_ON", tax_rate: 0.05 }),
    } as never);
    expect(res.status).toBe(422);
  });

  it("returns 404 when the business expense doesn't exist", async () => {
    (getRequestUser as Mock).mockResolvedValue(MANAGER_USER);
    mockUpdateSingle({ data: null, error: { code: "PGRST116" } });

    const res = await businessPATCH({
      params: { expenseId: "missing" },
      request: req("/api/expenses/business/missing", "PATCH", { amount: 200 }),
    } as never);
    expect(res.status).toBe(404);
  });

  it("returns 500 on an unexpected database error", async () => {
    (getRequestUser as Mock).mockResolvedValue(MANAGER_USER);
    mockUpdateSingle({ data: null, error: { code: "OTHER", message: "boom" } });

    const res = await businessPATCH({
      params: { expenseId: "be-1" },
      request: req("/api/expenses/business/be-1", "PATCH", { amount: 200 }),
    } as never);
    expect(res.status).toBe(500);
  });

  it("returns 200 on a valid update", async () => {
    (getRequestUser as Mock).mockResolvedValue(MANAGER_USER);
    mockUpdateSingle({ data: { ...BUSINESS_EXPENSE, amount: 200 }, error: null });

    const res = await businessPATCH({
      params: { expenseId: "be-1" },
      request: req("/api/expenses/business/be-1", "PATCH", { amount: 200 }),
    } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.amount).toBe(200);
  });
});

describe("DELETE /api/expenses/business/:expenseId", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await businessDELETE({
      params: { expenseId: "be-1" },
      request: req("/api/expenses/business/be-1", "DELETE"),
    } as never);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-manager roles", async () => {
    (getRequestUser as Mock).mockResolvedValue(SALES_USER);
    const res = await businessDELETE({
      params: { expenseId: "be-1" },
      request: req("/api/expenses/business/be-1", "DELETE"),
    } as never);
    expect(res.status).toBe(403);
  });

  it("returns 404 when the business expense doesn't exist", async () => {
    (getRequestUser as Mock).mockResolvedValue(MANAGER_USER);
    const selectSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const selectEq = vi.fn().mockReturnValue({ single: selectSingle });
    const select = vi.fn().mockReturnValue({ eq: selectEq });
    (getAdminClient as Mock).mockReturnValue({ from: () => ({ select }) });

    const res = await businessDELETE({
      params: { expenseId: "missing" },
      request: req("/api/expenses/business/missing", "DELETE"),
    } as never);
    expect(res.status).toBe(404);
  });

  it("returns 500 when the delete call itself fails", async () => {
    (getRequestUser as Mock).mockResolvedValue(MANAGER_USER);

    const selectSingle = vi.fn().mockResolvedValue({ data: { id: "be-1" }, error: null });
    const selectEq = vi.fn().mockReturnValue({ single: selectSingle });
    const select = vi.fn().mockReturnValue({ eq: selectEq });

    const deleteEq = vi.fn().mockResolvedValue({ error: { message: "db down" } });
    const del = vi.fn().mockReturnValue({ eq: deleteEq });

    (getAdminClient as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue({ select, delete: del }),
    });

    const res = await businessDELETE({
      params: { expenseId: "be-1" },
      request: req("/api/expenses/business/be-1", "DELETE"),
    } as never);
    expect(res.status).toBe(500);
  });

  it("returns 204 on successful delete", async () => {
    (getRequestUser as Mock).mockResolvedValue(MANAGER_USER);

    const selectSingle = vi.fn().mockResolvedValue({ data: { id: "be-1" }, error: null });
    const selectEq = vi.fn().mockReturnValue({ single: selectSingle });
    const select = vi.fn().mockReturnValue({ eq: selectEq });

    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn().mockReturnValue({ eq: deleteEq });

    (getAdminClient as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue({ select, delete: del }),
    });

    const res = await businessDELETE({
      params: { expenseId: "be-1" },
      request: req("/api/expenses/business/be-1", "DELETE"),
    } as never);
    expect(res.status).toBe(204);
  });
});

describe("POST /api/expenses/upload-url", () => {
  it("returns 403 for non-manager roles", async () => {
    (getRequestUser as Mock).mockResolvedValue(SALES_USER);
    const res = await uploadUrlPOST({
      request: req("/api/expenses/upload-url", "POST", { contentType: "application/pdf", fileSize: 1000 }),
    } as never);
    expect(res.status).toBe(403);
  });

  it("returns signed upload URL for allowed document types", async () => {
    (getRequestUser as Mock).mockResolvedValue(MANAGER_USER);
    const signedUrl = "https://storage.example/upload";
    const createSignedUploadUrl = vi.fn().mockResolvedValue({
      data: { signedUrl },
      error: null,
    });
    (getAdminClient as Mock).mockReturnValue({
      storage: { from: () => ({ createSignedUploadUrl }) },
    });

    const res = await uploadUrlPOST({
      request: req("/api/expenses/upload-url", "POST", { contentType: "application/pdf", fileSize: 2000 }),
    } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uploadUrl).toBe(signedUrl);
    expect(body.bucket).toBe("vehicle-documents");
    expect(body.storagePath).toContain("business-expenses/");
  });
});
