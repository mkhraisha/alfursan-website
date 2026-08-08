import { test, expect } from "playwright/test";
import { loginAsTestUser } from "./helpers/admin-auth";

/**
 * Drives the real Add Vehicle + Edit Vehicle admin UI end-to-end, writing to
 * every individual field the forms expose (Basics, Purchase, Pricing), and
 * asserts each save succeeds with no error toast.
 *
 * This exists because the Add Vehicle form silently omitted `engine_type`
 * (and several other optional spec fields) from its payload — a gap that
 * only showed up once a value was later edited through the Basics tab. A
 * per-field write test like this one is the only way to catch "the UI
 * doesn't know about column X" bugs before they reach production; asserting
 * against the API schema alone would not have caught it, since the field
 * really is optional there.
 *
 * Uses a dedicated test VIN (not the shared fixture VIN used by
 * scripts/e2e-seed-test-vehicle.mjs) and deletes it at the end regardless of
 * outcome. Requires the local Supabase stack running with test users seeded
 * (`node scripts/e2e-seed-test-users.mjs`) — self-skips otherwise.
 *
 * Note: like the rest of this suite, this test is verified against a real
 * `astro dev` server (not a production build) — so under a fully-parallel
 * *local* run (default `workers`, i.e. one per CPU core) it can occasionally
 * flake alongside other admin-write specs due to Vite's dev-server dependency
 * re-optimization under concurrent load, not the app under test. That's
 * exactly why CI (`playwright.config.ts`) pins `workers: 1` — run the full
 * suite locally with `npx playwright test --workers=1` for a reliable signal.
 */

const TEST_VIN = "5TFAX5GN0KX012345";

test.describe("Vehicle create + edit — every field writes cleanly", () => {
  test.skip(!process.env.SUPABASE_PUBLISHABLE_KEY, "SUPABASE_PUBLISHABLE_KEY not set — skipping authenticated UI tests");

  test("creates a vehicle and saves every field on every tab without error", async ({ browser }) => {
    const context = await browser.newContext();
    await loginAsTestUser(context, "manager");
    const page = await context.newPage();

    try {
      // Belt-and-suspenders: a prior run that crashed before cleanup could
      // have left TEST_VIN behind, which would 409 this run's create step.
      await context.request.delete(`/api/vehicles/${TEST_VIN}`).catch(() => {});

      // ── Create ──────────────────────────────────────────────────────────
      await page.goto("/admin/inventory/new");

      await page.getByTestId("av-vin").fill(TEST_VIN);
      await page.getByTestId("av-make").fill("Toyota");
      await page.getByTestId("av-model").fill("Camry");
      await page.getByTestId("av-year").fill("2022");
      await page.getByTestId("av-trim").fill("SE");
      await page.getByTestId("av-series").fill("XV70");
      await page.getByTestId("av-body_type").selectOption("sedan");
      await page.getByTestId("av-engine_type").fill("2.5L 4-Cylinder");
      await page.getByTestId("av-colour").fill("Midnight Black");
      await page.getByTestId("av-odometer").fill("12,500");
      await page.getByTestId("av-num_keys").fill("2");
      await page.getByTestId("av-drive_type").selectOption("fwd");
      await page.getByTestId("av-transmission").selectOption("automatic");
      await page.getByTestId("av-fuel_type").selectOption("gasoline");
      await page.getByTestId("av-cylinders").fill("4");
      await page.getByTestId("av-doors").fill("4");
      await page.getByTestId("av-purchase_date").fill(new Date().toISOString().slice(0, 10));
      await page.getByTestId("av-purchase_price").fill("22,000");
      await page.getByTestId("av-wholesale_price").fill("18,500");
      await page.getByTestId("av-advertised_price_cargurus").fill("24,900");
      await page.getByTestId("av-advertised_price_facebook").fill("23,500");
      await page.getByTestId("av-status").selectOption("frontline_ready");

      await page.getByTestId("av-submit").click();
      // Generous timeout: this is a real POST /api/vehicles round trip, and can
      // be slow the first time this route is hit against a dev server that's
      // already served many other requests earlier in the suite.
      await expect(page.locator(".av-toast--ok")).toHaveText("Vehicle added!", { timeout: 15_000 });
      await page.waitForURL(`**/admin/inventory/${TEST_VIN}`, { timeout: 15_000 });

      // ── Edit: Basics tab ─────────────────────────────────────────────────
      await page.getByTestId("vd-tab-basics").click();
      await page.getByTestId("vd-trim").fill("XSE");
      await page.getByTestId("vd-series").fill("XV70-Updated");
      await page.getByTestId("vd-year").fill("2023");
      await page.getByTestId("vd-body_type").selectOption("coupe");
      await page.getByTestId("vd-engine_type").fill("2.0L Turbo 4-Cylinder");
      await page.getByTestId("vd-colour").fill("Pearl White");
      await page.getByTestId("vd-odometer").fill("15,000");
      await page.getByTestId("vd-num_keys").fill("3");
      await page.getByTestId("vd-drive_type").selectOption("awd");
      await page.getByTestId("vd-transmission").selectOption("cvt");
      await page.getByTestId("vd-fuel_type").selectOption("hybrid");
      await page.getByTestId("vd-cylinders").fill("6");
      await page.getByTestId("vd-doors").fill("2");
      await page.getByTestId("vd-carfax_link").fill("https://www.carfax.ca/vhr/5TFAX5GN0KX012345");
      await page.getByTestId("vd-status").selectOption("on_lot_work_needed");
      await page.getByTestId("vd-ownership_status").selectOption("available");
      await page.getByTestId("vd-photography_status").selectOption("done");
      await page.getByTestId("vd-save-basics").click();
      await expect(page.getByTestId("vd-toast")).toHaveText("Saved!", { timeout: 15_000 });
      await expect(page.locator(".vd-toast--err")).toHaveCount(0);

      // Features (saves immediately, independent of the Save button above)
      await page.getByTestId("vd-new-feature").fill("Heated Seats");
      await page.getByTestId("vd-add-feature").click();
      await expect(page.getByTestId("vd-toast")).toHaveText("Saved!", { timeout: 15_000 });
      await expect(page.locator(".vd-toast--err")).toHaveCount(0);

      // Description / internal notes / disclosures (auto-save on blur)
      await page.getByTestId("vd-description").fill("E2E test public description.");
      await page.getByTestId("vd-internal_notes").fill("E2E test internal note.");
      await page.getByTestId("vd-disclosures").fill("E2E test disclosure.");
      await page.getByTestId("vd-disclosures").blur();
      await expect(page.getByTestId("vd-toast")).toHaveText("Saved!", { timeout: 15_000 });
      await expect(page.locator(".vd-toast--err")).toHaveCount(0);

      // ── Edit: Purchase tab ───────────────────────────────────────────────
      await page.getByTestId("vd-tab-purchase").click();
      await page.getByTestId("vd-purchase_date").fill(new Date().toISOString().slice(0, 10));
      await page.getByTestId("vd-purchase_price").fill("21,000");
      await page.getByTestId("vd-lead_source").fill("Referral");
      await page.getByTestId("vd-purchased_from_name").fill("Jane Seller");
      await page.getByTestId("vd-purchased_from_address").fill("123 Main St, Toronto, ON");
      await page.getByTestId("vd-purchaser_name").fill("John Buyer");
      await page.getByTestId("vd-purchaser_address").fill("456 Oak Ave, Ottawa, ON");
      await page.getByTestId("vd-save-purchase").click();
      await expect(page.getByTestId("vd-toast")).toHaveText("Saved!", { timeout: 15_000 });
      await expect(page.locator(".vd-toast--err")).toHaveCount(0);

      // ── Edit: Pricing tab ────────────────────────────────────────────────
      await page.getByTestId("vd-tab-pricing").click();
      await page.getByTestId("vd-wholesale_price").fill("17,500");
      await page.getByTestId("vd-advertised_price_cargurus").fill("25,900");
      await page.getByTestId("vd-advertised_price_facebook").fill("24,500");
      await page.getByTestId("vd-sale_price").fill("23,000");
      await page.getByTestId("vd-sale_date").fill(new Date().toISOString().slice(0, 10));
      await page.getByTestId("vd-save-pricing").click();
      await expect(page.getByTestId("vd-toast")).toHaveText("Saved!", { timeout: 15_000 });
      await expect(page.locator(".vd-toast--err")).toHaveCount(0);

      // ── Verify persistence: reload and spot-check a few fields ──────────
      await page.reload();
      await page.getByTestId("vd-tab-basics").click();
      await expect(page.getByTestId("vd-engine_type")).toHaveValue("2.0L Turbo 4-Cylinder");
      await expect(page.getByTestId("vd-trim")).toHaveValue("XSE");
    } finally {
      // Cleanup regardless of test outcome — dedicated VIN, safe to delete.
      // Note: request.delete() only rejects on a network-level failure, not on
      // a non-2xx response — log a warning on those so a leftover fixture
      // vehicle from a bad run doesn't silently break the *next* run's
      // duplicate-VIN insert.
      try {
        const res = await context.request.delete(`/api/vehicles/${TEST_VIN}`);
        if (!res.ok() && res.status() !== 404) {
          console.warn(`[admin-vehicle-full-field-write] cleanup delete of ${TEST_VIN} failed: ${res.status()}`);
        }
      } catch (err) {
        console.warn(`[admin-vehicle-full-field-write] cleanup delete of ${TEST_VIN} threw:`, err);
      }
      await context.close();
    }
  });
});
