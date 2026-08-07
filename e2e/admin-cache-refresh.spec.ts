import { test, expect } from "playwright/test";
import { loginAsTestUser } from "./helpers/admin-auth";

/**
 * Covers the new admin "Refresh Public Cache" button/endpoint
 * (src/pages/api/admin/refresh-cache.ts + src/lib/vercel-cache.ts).
 *
 * Doesn't require real Vercel credentials: without VERCEL_API_TOKEN /
 * VERCEL_PROJECT_ID set (the normal state for local/CI runs — see
 * check-env.ts's OPTIONAL_ENV), the endpoint reports a clear 501
 * "not configured" response instead of crashing, which is exactly what these
 * tests assert. The RBAC gate (manager-only, via cache:refresh in
 * src/lib/permissions.ts) is exercised regardless of that config state.
 */
test.describe("POST /api/admin/refresh-cache", () => {
  test.skip(!process.env.SUPABASE_PUBLISHABLE_KEY, "SUPABASE_PUBLISHABLE_KEY not set — skipping authenticated API tests");

  test("returns 401 when unauthenticated", async ({ request }) => {
    const res = await request.post("/api/admin/refresh-cache");
    expect(res.status()).toBe(401);
  });

  test("returns 403 for sales role (no cache:refresh permission)", async ({ browser }) => {
    const context = await browser.newContext();
    await loginAsTestUser(context, "sales");
    const res = await context.request.post("/api/admin/refresh-cache");
    expect(res.status()).toBe(403);
    await context.close();
  });

  test("manager role is authorized — either purges or reports 'not configured', never 403", async ({ browser }) => {
    const context = await browser.newContext();
    await loginAsTestUser(context, "manager");
    const res = await context.request.post("/api/admin/refresh-cache");
    // 200 if VERCEL_API_TOKEN/VERCEL_PROJECT_ID happen to be set in this env,
    // 501 (not configured) otherwise — both prove the permission check passed.
    expect([200, 501]).toContain(res.status());
    await context.close();
  });

  test("Inventory page renders a 'Refresh Public Cache' button that surfaces a toast on click", async ({ browser }) => {
    const context = await browser.newContext();
    await loginAsTestUser(context, "manager");
    const page = await context.newPage();

    await page.goto("/admin/inventory");
    const button = page.getByRole("button", { name: /Refresh Public Cache/i });
    await expect(button).toBeVisible();
    await button.click();

    // Toast renders regardless of whether the purge actually ran (ok) or the
    // endpoint reported "not configured" (err) — either way a message shows.
    await expect(page.locator(".inv-toast")).toBeVisible({ timeout: 5_000 });

    await context.close();
  });
});
