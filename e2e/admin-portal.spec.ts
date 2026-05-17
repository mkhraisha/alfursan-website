import { test, expect } from "playwright/test";

/**
 * Admin portal E2E tests.
 *
 * Auth flow uses magic-link which can't be automated in E2E without a real
 * inbox. We test:
 *   1. The login page renders correctly
 *   2. Protected routes redirect to /admin/ when unauthenticated
 *   3. Error query params show the correct message on the login page
 */

test.describe("Admin login page", () => {
  test("loads with a 200 status", async ({ page }) => {
    const response = await page.goto("/admin/");
    expect(response?.status()).toBe(200);
  });

  test("shows the Admin Portal heading", async ({ page }) => {
    await page.goto("/admin/");
    await expect(page.getByText("Admin Portal")).toBeVisible();
  });

  test("has an email input and submit button", async ({ page }) => {
    await page.goto("/admin/");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("shows unauthorized error when ?error=unauthorized", async ({ page }) => {
    await page.goto("/admin/?error=unauthorized");
    await expect(
      page.getByText(/not authorised/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test("shows session-expired error when ?error=invalid_token", async ({ page }) => {
    await page.goto("/admin/?error=invalid_token");
    await expect(
      page.getByText(/session expired/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test("submit button stays on login page after submit attempt", async ({ page }) => {
    await page.goto("/admin/");
    await page.locator('input[type="email"]').fill("test@example.com");
    await page.route("**/auth/v1/otp**", (route) => route.abort("failed"));
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/(\?.*)?$/);
  });
});

test.describe("Protected admin routes redirect to login", () => {
  test("/admin/dashboard/ redirects unauthenticated users to /admin/", async ({ page }) => {
    const response = await page.goto("/admin/dashboard/");
    const finalUrl = page.url();
    const status = response?.status() ?? 0;
    const isRedirectedToLogin =
      finalUrl.includes("/admin/") && !finalUrl.includes("/dashboard/");
    const isLoginShownDirectly =
      (await page.locator('input[type="email"]').count()) > 0;

    expect(status < 400).toBe(true);
    expect(isRedirectedToLogin || isLoginShownDirectly).toBe(true);
  });

  test("/admin/inventory/ redirects unauthenticated users to /admin/", async ({ page }) => {
    const response = await page.goto("/admin/inventory/");
    const finalUrl = page.url();
    const status = response?.status() ?? 0;
    const isRedirectedToLogin =
      finalUrl.includes("/admin/") && !finalUrl.includes("/inventory/");
    const isLoginShownDirectly =
      (await page.locator('input[type="email"]').count()) > 0;

    expect(status < 400).toBe(true);
    expect(isRedirectedToLogin || isLoginShownDirectly).toBe(true);
  });

  test("/admin/applications/ redirects unauthenticated users to /admin/", async ({ page }) => {
    const response = await page.goto("/admin/applications/");
    const finalUrl = page.url();
    const status = response?.status() ?? 0;
    const isRedirectedToLogin =
      finalUrl.includes("/admin/") && !finalUrl.includes("/applications/");
    const isLoginShownDirectly =
      (await page.locator('input[type="email"]').count()) > 0;

    expect(status < 400).toBe(true);
    expect(isRedirectedToLogin || isLoginShownDirectly).toBe(true);
  });
});

test.describe("Admin signout", () => {
  test("/admin/signout/ clears session and redirects to /admin/", async ({ page }) => {
    await page.goto("/admin/signout/");
    await expect(page).toHaveURL(/\/admin\//);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
