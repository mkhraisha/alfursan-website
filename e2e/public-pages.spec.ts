import { test, expect } from "playwright/test";

/**
 * Public page smoke tests — no auth required.
 * Verify pages load, render key content, and have no unexpected console errors.
 */

test.describe("Home page", () => {
  test("loads with a 200 status", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
  });

  test("shows the brand logo image", async ({ page }) => {
    await page.goto("/");
    // Brand is an image with alt text, not a plain text node
    await expect(page.locator('img[alt*="Alfursan"]').first()).toBeVisible();
  });

  test("has navigation links", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav a").first()).toBeVisible();
  });

  test("has no unexpected console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Ignore known dev-only Vercel analytics CSP block — not a real app error
        if (text.includes("va.vercel-scripts.com")) return;
        errors.push(text);
      }
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });
});

test.describe("Finance application page", () => {
  test("loads and shows the form", async ({ page }) => {
    const response = await page.goto("/finance/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /apply for financing/i })).toBeVisible();
  });

  test("shows required form fields", async ({ page }) => {
    await page.goto("/finance/");
    await expect(page.locator("form, [data-testid='finance-form']").first()).toBeVisible();
  });
});

test.describe("Loan calculator page", () => {
  test("loads with a 200 status", async ({ page }) => {
    const response = await page.goto("/loan-calculator/");
    expect(response?.status()).toBe(200);
  });
});

test.describe("About Us page", () => {
  test("loads with a 200 status", async ({ page }) => {
    const response = await page.goto("/about-us/");
    expect(response?.status()).toBe(200);
  });
});

test.describe("FAQ page", () => {
  test("loads with a 200 status", async ({ page }) => {
    const response = await page.goto("/faq/");
    expect(response?.status()).toBe(200);
  });
});

test.describe("Contact Us page", () => {
  test("loads with a 200 status", async ({ page }) => {
    const response = await page.goto("/contact-us/");
    expect(response?.status()).toBe(200);
  });
});

test.describe("Search / inventory page", () => {
  test("loads with a 200 status", async ({ page }) => {
    const response = await page.goto("/search/");
    expect(response?.status()).toBe(200);
  });
});
