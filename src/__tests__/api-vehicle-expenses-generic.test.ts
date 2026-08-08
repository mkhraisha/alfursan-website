import { vi, describe, it, expect, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../lib/supabase-admin");
vi.mock("../lib/request-user");
vi.mock("../lib/audit");

import { getAdminClient } from "../lib/supabase-admin";
import { getRequestUser } from "../lib/request-user";
import { writeAudit } from "../lib/audit";
import type { RequestUser } from "../lib/request-user";

import { PATCH as expensePATCH } from "../pages/api/vehicles/expenses/[expenseId]";

const ADMIN_USER: RequestUser = { email: "admin@example.com", role: "manager", userId: "user-1" };
const TEST_VIN = "1HGCM82633A004352";

function req(url: string, method = "PATCH", body?: unknown) {
  return new Request(`https://alfursanauto.ca${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function mockUpdateSingle(result: { data: unknown; error: unknown }) {
  const singleFn = vi.fn().mockResolvedValue(result);
  const selectFn = vi.fn().mockReturnValue({ single: singleFn });
  const eqFn     = vi.fn().mockReturnValue({ select: selectFn });
  const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
  (getAdminClient as Mock).mockReturnValue({ from: () => ({ update: updateFn }) });
}

beforeEach(() => {
  (getRequestUser as Mock).mockResolvedValue(null);
});

describe("PATCH /api/vehicles/expenses/:expenseId", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await expensePATCH({
      params: { expenseId: "exp-1" },
      request: req("/api/vehicles/expenses/exp-1", "PATCH", { reimbursed: true }),
    } as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const request = new Request("https://alfursanauto.ca/api/vehicles/expenses/exp-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });
    const res = await expensePATCH({ params: { expenseId: "exp-1" }, request } as never);
    expect(res.status).toBe(400);
  });

  it("returns 422 when reimbursed is missing/non-boolean", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    (getAdminClient as Mock).mockReturnValue({});

    const res = await expensePATCH({
      params: { expenseId: "exp-1" },
      request: req("/api/vehicles/expenses/exp-1", "PATCH", { reimbursed: "yes" }),
    } as never);
    expect(res.status).toBe(422);
  });

  it("returns 404 when the expense doesn't exist", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    mockUpdateSingle({ data: null, error: { code: "PGRST116" } });

    const res = await expensePATCH({
      params: { expenseId: "missing" },
      request: req("/api/vehicles/expenses/missing", "PATCH", { reimbursed: true }),
    } as never);
    expect(res.status).toBe(404);
  });

  it("returns 500 on an unexpected database error", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    mockUpdateSingle({ data: null, error: { code: "OTHER", message: "boom" } });

    const res = await expensePATCH({
      params: { expenseId: "exp-1" },
      request: req("/api/vehicles/expenses/exp-1", "PATCH", { reimbursed: true }),
    } as never);
    expect(res.status).toBe(500);
  });

  it("succeeds for a VIN-linked expense and audits with the vin as entityRef", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    mockUpdateSingle({ data: { id: "exp-1", vin: TEST_VIN, reimbursed: true }, error: null });

    const res = await expensePATCH({
      params: { expenseId: "exp-1" },
      request: req("/api/vehicles/expenses/exp-1", "PATCH", { reimbursed: true }),
    } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reimbursed).toBe(true);
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "expense_updated", entityRef: TEST_VIN }),
    );
  });

  it("succeeds for a general (no-VIN) expense and falls back entityRef to 'general'", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    mockUpdateSingle({ data: { id: "exp-2", vin: null, reimbursed: false }, error: null });

    const res = await expensePATCH({
      params: { expenseId: "exp-2" },
      request: req("/api/vehicles/expenses/exp-2", "PATCH", { reimbursed: false }),
    } as never);
    expect(res.status).toBe(200);
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "expense_updated", entityRef: "general" }),
    );
  });
});
