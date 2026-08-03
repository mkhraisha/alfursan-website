import { test, expect } from "playwright/test";

/**
 * Public conversion-path smoke coverage: the individual vehicle listing page
 * (the actual page a shopper lands on from search/Google/social — previously
 * completely uncovered), and /sold/. Both pages are SSR'd (prerender = false)
 * against the DMS `vehicles` table (WordPress migration Part 5 — VIN-based
 * routing replaced the old WP-slug routing).
 */
test.describe("Vehicle listing detail page", () => {
  test("renders a real listing discovered from /search/", async ({ page }) => {
    await page.goto("/search/");
    const listingLink = page.locator('a[href^="/listing/"]').first();
    await expect(listingLink).toBeVisible({ timeout: 10_000 });
    const href = await listingLink.getAttribute("href");
    expect(href).toBeTruthy();
    // /listing/{VIN}/ — a 17-character VIN, not a WordPress slug
    expect(href).toMatch(/^\/listing\/[A-HJ-NPR-Z0-9]{17}\/$/);

    const response = await page.goto(href!);
    expect(response?.status()).toBe(200);

    // Attribute list (Year/Make/Model/etc.) — at least one should render
    await expect(page.getByText("Year", { exact: true })).toBeVisible();
    // Financing CTA — the actual conversion action this page exists for
    await expect(page.locator('a[href^="/finance"]').first()).toBeVisible();
  });

  test("redirects to the 404 page for a nonexistent VIN", async ({ page }) => {
    const response = await page.goto("/listing/1HGCM82633A999999/");
    // fetchPublicVehicleByVin returns null -> Astro.redirect("/404")
    expect(response?.status()).toBe(404);
    await expect(page).toHaveURL(/\/404\/?$/);
  });
});

test.describe("Sold vehicles page", () => {
  test("loads with a 200 status", async ({ page }) => {
    const response = await page.goto("/sold/");
    expect(response?.status()).toBe(200);
  });
});
