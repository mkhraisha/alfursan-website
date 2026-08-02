import { test, expect } from "playwright/test";
import { loginAsTestUser } from "./helpers/admin-auth";

/**
 * Proves the cookie-injection auth helper actually works end-to-end: signs
 * in as the seeded manager test user and confirms the dashboard renders
 * instead of redirecting to /admin/ (the login page).
 *
 * Requires the local Supabase stack running with test users seeded
 * (`node scripts/e2e-seed-test-users.mjs`) — self-skips otherwise.
 */
test.describe("Authenticated admin dashboard (smoke)", () => {
  test.skip(!process.env.SUPABASE_PUBLISHABLE_KEY, "SUPABASE_PUBLISHABLE_KEY not set — skipping authenticated UI tests");

  test("manager sees the dashboard instead of the login page", async ({ browser }) => {
    const context = await browser.newContext();
    await loginAsTestUser(context, "manager");
    const page = await context.newPage();

    await page.goto("/admin/dashboard/");
    await expect(page).toHaveURL(/\/admin\/dashboard\/?$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await context.close();
  });
});
