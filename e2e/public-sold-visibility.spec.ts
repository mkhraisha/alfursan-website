import { test, expect } from "playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Verifies the agreed public-visibility rule for sold vehicles
 * (src/lib/vehicles.ts: isPubliclyVisible / soldVisibilityCutoff):
 * a vehicle sold within the last 30 days must still be publicly visible
 * (homepage, /search/, GET /api/vehicles); a vehicle sold more than 30
 * days ago must not be. Also verifies every public surface that renders
 * that still-visible sold vehicle marks it with a "Sold" badge/tag
 * (`isSold` in src/lib/public-vehicle-view.ts) — a prior version of this
 * feature only wired the badge into some of these surfaces (homepage,
 * search) while silently missing others (the /sold/ archive page, the
 * listing detail page, and its Related Listings section), so this test
 * exists specifically to catch that class of regression across every
 * surface, not just the first one someone happens to check by eye.
 *
 * Seeds dedicated vehicles directly against the local Supabase stack
 * with the service-role key (same pattern as scripts/e2e-seed-test-vehicle.mjs),
 * bypassing the admin API entirely — the point here is to pin down the
 * *public read* behaviour for known `status`/`sale_date` combinations, not
 * to exercise the write path (that's covered by
 * e2e/admin-vehicle-full-field-write.spec.ts and the RBAC tests in
 * e2e/vehicles-api.spec.ts). Self-skips if SUPABASE_SECRET_KEY isn't set,
 * and refuses to run against anything but a local Supabase URL.
 *
 * The Popular Makes carousel (index.astro's other sold-badge surface) is
 * intentionally not covered here — it only surfaces a make's cars once
 * that make is one of the site's most-listed, which this fixture data
 * can't reliably guarantee. It's covered instead by a deterministic
 * component-render unit test (src/__tests__/popular-makes.test.tsx).
 */

const RECENT_SOLD_VIN = "1HGCM82633A004352";
const STALE_SOLD_VIN = "1HGCM82633A004353";
// Same make/body_type as RECENT_SOLD_VIN and not sold, so relatedCars'
// same-make-or-body_type match (listing/[vin].astro) reliably surfaces
// RECENT_SOLD_VIN in this vehicle's own Related Listings section.
const RELATED_VIN = "1HGCM82633A004354";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

test.describe("Public visibility of sold vehicles", () => {
  // Force a single worker for this file: with fullyParallel + multiple
  // workers, each worker runs its own copy of beforeAll/afterAll against the
  // same fixture VINs, racing each other's delete/insert and failing with
  // duplicate-key errors.
  test.describe.configure({ mode: "serial" });
  test.skip(!SUPABASE_URL || !SERVICE_KEY, "SUPABASE_SECRET_KEY not set — skipping public sold-visibility tests");

  let admin: ReturnType<typeof createClient>;

  test.beforeAll(async () => {
    const host = new URL(SUPABASE_URL!).hostname;
    if (!["127.0.0.1", "localhost"].includes(host)) {
      throw new Error(`Refusing to seed against non-local SUPABASE_URL: ${SUPABASE_URL}`);
    }
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: cleanupError } = await admin
      .from("vehicles")
      .delete()
      .in("vin", [RECENT_SOLD_VIN, STALE_SOLD_VIN, RELATED_VIN]);
    if (cleanupError) throw cleanupError;

    // `createClient` here is unparameterized by a generated `Database` type
    // (same as everywhere else in this codebase — see src/lib/supabase-admin.ts),
    // so supabase-js can't infer an Insert row shape for an array literal and
    // falls back to `never`. Cast at the boundary rather than typing the
    // client, matching how the rest of the app treats this client generically.
    const rows = [
      {
        vin: RECENT_SOLD_VIN,
        make: "Honda",
        model: "E2eRecentSold",
        year: 2021,
        body_type: "sedan",
        status: "sold",
        sale_date: daysAgo(5), // within the 30-day window -> must stay visible
        images_json: ["e2e-fixture/recent-sold.jpg"],
      },
      {
        vin: STALE_SOLD_VIN,
        make: "Honda",
        model: "E2eStaleSold",
        year: 2021,
        body_type: "sedan",
        status: "sold",
        sale_date: daysAgo(40), // outside the 30-day window -> must be hidden
        images_json: ["e2e-fixture/stale-sold.jpg"],
      },
      {
        vin: RELATED_VIN,
        make: "Honda",
        model: "E2eRelatedAvailable",
        year: 2021,
        body_type: "sedan",
        status: "frontline_ready",
        images_json: ["e2e-fixture/related-available.jpg"],
      },
    ] as never[];
    const { error: insertError } = await admin.from("vehicles").insert(rows);
    if (insertError) throw insertError;
  });

  test.afterAll(async () => {
    await admin.from("vehicles").delete().in("vin", [RECENT_SOLD_VIN, STALE_SOLD_VIN, RELATED_VIN]);
  });

  test("GET /api/vehicles includes a vehicle sold within the last 30 days, excludes one sold over 30 days ago", async ({ request }) => {
    const res = await request.get("/api/vehicles?limit=200");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const vins = (body.data as Array<{ vin: string }>).map((v) => v.vin);

    expect(vins).toContain(RECENT_SOLD_VIN);
    expect(vins).not.toContain(STALE_SOLD_VIN);
  });

  test("/search/ renders a vehicle sold within the last 30 days with a Sold badge, but not one sold over 30 days ago", async ({ page }) => {
    const response = await page.goto("/search/");
    expect(response?.status()).toBe(200);

    const link = page.getByRole("link", { name: /E2eRecentSold/ }).first();
    await expect(link).toBeVisible({ timeout: 10_000 });
    const card = page.locator("article", { has: link }).first();
    await expect(card.locator(".sold-badge")).toBeVisible();

    await expect(page.getByRole("link", { name: /E2eStaleSold/ })).toHaveCount(0);
  });

  test("homepage renders a vehicle sold within the last 30 days with a Sold badge, but not one sold over 30 days ago", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    const link = page.getByRole("link", { name: /E2eRecentSold/ }).first();
    await expect(link).toBeVisible({ timeout: 10_000 });
    const card = page.locator("article", { has: link }).first();
    await expect(card.locator(".sold-badge")).toBeVisible();

    await expect(page.getByRole("link", { name: /E2eStaleSold/ })).toHaveCount(0);
  });

  test("/sold/ renders a vehicle sold within the last 30 days with a Sold badge", async ({ page }) => {
    const response = await page.goto("/sold/");
    expect(response?.status()).toBe(200);

    const link = page.getByRole("link", { name: /E2eRecentSold/ }).first();
    await expect(link).toBeVisible({ timeout: 10_000 });
    const card = page.locator("article", { has: link }).first();
    await expect(card.locator(".sold-badge")).toBeVisible();
  });

  test("the listing detail page shows a Sold tag for a vehicle sold within the last 30 days", async ({ page }) => {
    const response = await page.goto(`/listing/${RECENT_SOLD_VIN}/`);
    expect(response?.status()).toBe(200);

    await expect(page.locator(".tag-sold")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".tag-sold")).toHaveText(/Sold/);
  });

  test("Related Listings marks a sold vehicle with a Sold badge", async ({ page }) => {
    const response = await page.goto(`/listing/${RELATED_VIN}/`);
    expect(response?.status()).toBe(200);

    const related = page.locator("section.related");
    await expect(related).toBeVisible({ timeout: 10_000 });
    await expect(related.getByRole("link", { name: /E2eRecentSold/ }).first()).toBeVisible();
    await expect(related.locator(`a[href="/listing/${RECENT_SOLD_VIN}/"] .sold-badge`)).toBeVisible();
  });
});
