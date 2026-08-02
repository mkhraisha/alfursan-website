import { test, expect } from "playwright/test";
import { loginAsTestUser } from "./helpers/admin-auth";

/**
 * Smoke coverage for every authenticated /admin/** page. Before this, the
 * only test ever exercising the admin UI was the login page itself (auth
 * uses magic-link, which can't be automated) — dashboard, inventory,
 * expenses, reports, applications, users, and garage all rendered untested.
 *
 * Requires the local Supabase stack running with test users seeded
 * (`node scripts/e2e-seed-test-users.mjs`) — self-skips otherwise.
 */
test.describe("Authenticated admin pages (smoke)", () => {
  test.skip(!process.env.SUPABASE_PUBLISHABLE_KEY, "SUPABASE_PUBLISHABLE_KEY not set — skipping authenticated UI tests");

  const MANAGER_PAGES: Array<{ path: string; title: string }> = [
    { path: "/admin/dashboard/", title: "Dashboard" },
    { path: "/admin/inventory/", title: "Inventory" },
    { path: "/admin/expenses/", title: "Expenses" },
    { path: "/admin/expenses/business-expenses/", title: "Business Expenses" },
    { path: "/admin/reports/", title: "Reports" },
    { path: "/admin/reports/sales/", title: "Sales Report" },
    { path: "/admin/applications/", title: "Applications" },
    { path: "/admin/users/", title: "Users" },
    { path: "/admin/garage/", title: "Garage Register" },
  ];

  for (const { path, title } of MANAGER_PAGES) {
    test(`manager can load ${path}`, async ({ browser }) => {
      const context = await browser.newContext();
      await loginAsTestUser(context, "manager");
      const page = await context.newPage();

      const response = await page.goto(path);
      expect(response?.status(), `${path} should not error`).toBeLessThan(400);
      await expect(page).toHaveTitle(`${title} — Alfursan Admin`);
      // Not bounced to the login page
      await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}$`));

      await context.close();
    });
  }

  const SALES_ALLOWED_PAGES = ["/admin/dashboard/", "/admin/inventory/", "/admin/garage/"];
  const SALES_RESTRICTED_PAGES = [
    "/admin/reports/",
    "/admin/reports/sales/",
    "/admin/expenses/",
    "/admin/expenses/business-expenses/",
    "/admin/users/",
  ];

  for (const path of SALES_ALLOWED_PAGES) {
    test(`sales role can load ${path}`, async ({ browser }) => {
      const context = await browser.newContext();
      await loginAsTestUser(context, "sales");
      const page = await context.newPage();

      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);
      await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}$`));

      await context.close();
    });
  }

  for (const path of SALES_RESTRICTED_PAGES) {
    test(`sales role is redirected away from ${path}`, async ({ browser }) => {
      const context = await browser.newContext();
      await loginAsTestUser(context, "sales");
      const page = await context.newPage();

      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/\?error=unauthorized/);

      await context.close();
    });
  }
});
