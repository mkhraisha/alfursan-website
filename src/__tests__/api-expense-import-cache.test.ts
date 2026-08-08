import { vi, describe, it, expect } from "vitest";
import type { Mock } from "vitest";

/**
 * Regression test: /api/vehicles/import and /api/vehicles/expenses/import are
 * POST-only, mutating endpoints. They must never be cacheable — without an
 * explicit `Cache-Control: no-store`, and with the adapter's ISR config
 * routing every non-prerendered route (including these) through Vercel's
 * shared ISR function, a request could be served a stale cached response
 * instead of running fresh. See astro.config.mjs `isr.exclude`.
 */

vi.mock("../lib/supabase-admin");
vi.mock("../lib/request-user");
vi.mock("../lib/audit");

import { getAdminClient } from "../lib/supabase-admin";
import { getRequestUser } from "../lib/request-user";
import type { RequestUser } from "../lib/request-user";
import { writeAudit } from "../lib/audit";
import { POST as expenseImportPOST } from "../pages/api/vehicles/expenses/import";

const ADMIN_USER: RequestUser = { email: "admin@example.com", role: "manager", userId: "user-1" };

function makeImportFormData(csv: string, mapping: Record<string, string>, preview = false) {
  const fd = new FormData();
  fd.append("file", new Blob([csv], { type: "text/csv" }), "import.csv");
  fd.append("mapping", JSON.stringify(mapping));
  if (preview) fd.append("preview", "true");
  return fd;
}

describe("POST /api/vehicles/expenses/import — Cache-Control", () => {
  it("never sets a cacheable Cache-Control header on the response", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    (getAdminClient as Mock).mockReturnValue({});

    // No VIN column mapped — a general (non-vehicle) expense — so the handler
    // skips the vehicle-lookup query entirely and we don't need to mock it.
    const csv = ["Category,Description,Amount", "other,Office supplies,25.00"].join("\n");
    const mapping = { Category: "category", Description: "description", Amount: "amount" };

    const request = new Request("https://alfursanauto.ca/api/vehicles/expenses/import", {
      method: "POST",
      body: makeImportFormData(csv, mapping, true),
    });
    const res = await expenseImportPOST({ request } as never);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("POST /api/vehicles/expenses/import — non-preview insert path", () => {
  const MAPPING = { Category: "category", Description: "description", Amount: "amount", VIN: "vin" };

  function mockKnownVins(vins: string[]) {
    const inFn = vi.fn().mockResolvedValue({ data: vins.map((vin) => ({ vin })), error: null });
    const selectFn = vi.fn().mockReturnValue({ in: inFn });
    return selectFn;
  }

  it("reports a per-row validation failure without inserting it", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    // amount=0 fails expenseCreateSchema's "cannot be zero" refine.
    const csv = ["Category,Description,Amount,VIN", "repair,Fix brakes,0,"].join("\n");

    (getAdminClient as Mock).mockReturnValue({
      from: () => ({ select: mockKnownVins([]) }),
    });

    const request = new Request("https://alfursanauto.ca/api/vehicles/expenses/import", {
      method: "POST",
      body: makeImportFormData(csv, MAPPING),
    });
    const res  = await expenseImportPOST({ request } as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.created).toBe(0);
    expect(body.failed).toBe(1);
    expect(body.errors[0]).toMatchObject({ row: 2 });
  });

  it("reports an unknown-VIN row as an error and skips inserting it", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const csv = ["Category,Description,Amount,VIN", "repair,Fix brakes,500,UNKNOWNVIN123"].join("\n");

    (getAdminClient as Mock).mockReturnValue({
      from: () => ({ select: mockKnownVins([]) }), // no known vehicles
    });

    const request = new Request("https://alfursanauto.ca/api/vehicles/expenses/import", {
      method: "POST",
      body: makeImportFormData(csv, MAPPING),
    });
    const res  = await expenseImportPOST({ request } as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.created).toBe(0);
    expect(body.failed).toBe(1);
    expect(body.errors[0]).toMatchObject({ column: "vin", vin: "UNKNOWNVIN123" });
  });

  it("returns an early created:0 response when every row failed and none matched", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const csv = ["Category,Description,Amount", "repair,Fix brakes,0"].join("\n");

    const insertFn = vi.fn();
    (getAdminClient as Mock).mockReturnValue({
      from: (table: string) => {
        if (table === "vehicle_expenses") return { insert: insertFn };
        return { select: mockKnownVins([]) };
      },
    });

    const request = new Request("https://alfursanauto.ca/api/vehicles/expenses/import", {
      method: "POST",
      body: makeImportFormData(csv, { Category: "category", Description: "description", Amount: "amount" }),
    });
    const res  = await expenseImportPOST({ request } as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ created: 0, failed: 1, errors: expect.any(Array) });
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("inserts matched rows, counts created, and writes an audit entry", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const csv = ["Category,Description,Amount", "repair,Fix brakes,500"].join("\n");

    const insertFn = vi.fn().mockResolvedValue({ error: null });
    (getAdminClient as Mock).mockReturnValue({
      from: (table: string) => {
        if (table === "vehicle_expenses") return { insert: insertFn };
        return { select: mockKnownVins([]) };
      },
    });

    const request = new Request("https://alfursanauto.ca/api/vehicles/expenses/import", {
      method: "POST",
      body: makeImportFormData(csv, { Category: "category", Description: "description", Amount: "amount" }),
    });
    const res  = await expenseImportPOST({ request } as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ created: 1, failed: 0, errors: [] });
    expect(insertFn).toHaveBeenCalledWith(expect.objectContaining({ vin: null, category: "repair" }));
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "csv_import", entityRef: "1 expenses imported" }),
    );
  });

  it("counts a per-row insert failure without aborting the rest of the batch", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const csv = [
      "Category,Description,Amount",
      "repair,Fix brakes,500",
      "gas,Fuel,100",
    ].join("\n");

    const insertFn = vi.fn()
      .mockResolvedValueOnce({ error: { message: "insert failed" } })
      .mockResolvedValueOnce({ error: null });
    (getAdminClient as Mock).mockReturnValue({
      from: (table: string) => {
        if (table === "vehicle_expenses") return { insert: insertFn };
        return { select: mockKnownVins([]) };
      },
    });

    const request = new Request("https://alfursanauto.ca/api/vehicles/expenses/import", {
      method: "POST",
      body: makeImportFormData(csv, { Category: "category", Description: "description", Amount: "amount" }),
    });
    const res  = await expenseImportPOST({ request } as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.created).toBe(1);
    expect(body.failed).toBe(1);
    expect(body.errors[0]).toMatchObject({ error: "insert failed" });
  });

  it("returns 500 with a preview-aware message when an unhandled exception is thrown", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    // getAdminClient() throws — simulates any unexpected failure inside the try block.
    (getAdminClient as Mock).mockImplementation(() => {
      throw new Error("boom");
    });
    const csv = ["Category,Description,Amount", "repair,Fix brakes,500"].join("\n");

    const request = new Request("https://alfursanauto.ca/api/vehicles/expenses/import", {
      method: "POST",
      body: makeImportFormData(csv, { Category: "category", Description: "description", Amount: "amount" }, true),
    });
    const res  = await expenseImportPOST({ request } as never);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toMatch(/preview/i);
  });
});
