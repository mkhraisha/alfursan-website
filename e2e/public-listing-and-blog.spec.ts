import { test, expect } from "playwright/test";

/**
 * Public conversion-path smoke coverage: the individual vehicle listing page
 * (the actual page a shopper lands on from search/Google/social — previously
 * completely uncovered), /sold/, and /blog/. All are WordPress-backed and
 * SSR'd (prerender = false for listing/sold), so these exercise the real
 * getCars/getCarBySlug/getPosts/getPostBySlug pipeline against the live
 * WordPress API.
 */
test.describe("Vehicle listing detail page", () => {
  test("renders a real listing discovered from /search/", async ({ page }) => {
    await page.goto("/search/");
    const listingLink = page.locator('a[href^="/listing/"]').first();
    await expect(listingLink).toBeVisible({ timeout: 10_000 });
    const href = await listingLink.getAttribute("href");
    expect(href).toBeTruthy();

    const response = await page.goto(href!);
    expect(response?.status()).toBe(200);

    // Attribute list (Year/Make/Model/etc.) — at least one should render
    await expect(page.getByText("Year", { exact: true })).toBeVisible();
    // Financing CTA — the actual conversion action this page exists for
    await expect(page.locator('a[href^="/finance"]').first()).toBeVisible();
  });

  test("redirects to the 404 page for a nonexistent slug", async ({ page }) => {
    const response = await page.goto("/listing/this-slug-does-not-exist-e2e/");
    // getCarBySlug returns null -> Astro.redirect("/404")
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

test.describe("Blog", () => {
  test("index loads with a 200 status", async ({ page }) => {
    const response = await page.goto("/blog/");
    expect(response?.status()).toBe(200);
  });

  test("a real post (if any exist) renders its own page", async ({ page }) => {
    await page.goto("/blog/");
    const postLink = page.locator('a[href^="/blog/"]:not([href="/blog/"])').first();
    const count = await postLink.count();
    if (count === 0) {
      test.skip(); // no posts published — nothing further to check
      return;
    }

    const href = await postLink.getAttribute("href");
    const response = await page.goto(href!);
    expect(response?.status()).toBe(200);
  });
});
