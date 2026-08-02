import { test, expect } from "playwright/test";
import { loginAsTestUser } from "./helpers/admin-auth";

/**
 * Drives the expense CSV importer UI end-to-end (upload -> map -> preview ->
 * confirm -> summary), as a manager. This is the flow behind two real
 * production incidents (see CHANGELOG: FUNCTION_INVOCATION_FAILED on
 * preview, and API routes served through Vercel's ISR cache) — both were
 * only ever caught after shipping, because no test had ever driven this UI.
 *
 * Uses a general (no-VIN) expense so the test doesn't depend on any
 * existing vehicle. Requires the local Supabase stack running with test
 * users seeded (`node scripts/e2e-seed-test-users.mjs`) — self-skips
 * otherwise.
 */
test.describe("Expense CSV import (UI)", () => {
  test.skip(!process.env.SUPABASE_PUBLISHABLE_KEY, "SUPABASE_PUBLISHABLE_KEY not set — skipping authenticated UI tests");

  test("uploads, maps, previews, and imports a general expense", async ({ browser }) => {
    const context = await browser.newContext();
    await loginAsTestUser(context, "manager");
    const page = await context.newPage();

    await page.goto("/admin/inventory/import-expenses");
    await expect(page.getByText("Click to select or drag & drop a CSV file")).toBeVisible();

    const csv = "Category,Description,Amount ($)\nother,E2E Test Expense,42.50\n";
    await page.locator('input[type="file"]').setInputFiles({
      name: "e2e-expenses.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });

    await page.getByRole("button", { name: "Next: Map Columns →" }).click();

    // Category/Description/"Amount ($)" all auto-map by header name — the
    // mapped-column count should already read 3 of 3 with no manual mapping.
    await expect(page.getByText("3 of 3 columns mapped")).toBeVisible();

    await page.getByRole("button", { name: "Preview →" }).click();
    await expect(page.getByText("✓ Valid: 1")).toBeVisible();

    await page.getByRole("button", { name: /Confirm Import \(1 rows?\) →/ }).click();
    await expect(page.getByRole("heading", { name: "Ready to Import" })).toBeVisible();

    await page.getByRole("button", { name: "Confirm Import" }).click();
    await expect(page.getByRole("heading", { name: "Import Complete" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("✓ 1 created")).toBeVisible();

    await context.close();
  });
});
