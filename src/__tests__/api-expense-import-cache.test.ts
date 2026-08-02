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
