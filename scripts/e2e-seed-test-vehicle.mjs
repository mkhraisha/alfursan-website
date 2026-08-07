#!/usr/bin/env node
/**
 * Seeds one publicly-visible fixture vehicle against a running local
 * Supabase stack, for the public conversion-path e2e suite
 * (e2e/public-listing.spec.ts, e2e/vehicles-api.spec.ts) which discovers a
 * real listing dynamically from /search/ rather than hardcoding a VIN.
 *
 * Since WP-migration Part 5 rewired the public site off of live WordPress
 * data and onto the `vehicles` table exclusively, a freshly-reset local
 * Supabase stack has zero vehicles — nothing seeds one otherwise. Run this
 * after `supabase start` + `db reset` and before starting the app.
 *
 * Local-only: writes via the service-role admin API against SUPABASE_URL,
 * which in CI/local dev always points at 127.0.0.1. Never run this against
 * a production SUPABASE_URL.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "[e2e-seed-vehicle] Missing SUPABASE_URL / SUPABASE_SECRET_KEY.\n" +
    "Run `supabase start` first and export its values (see README Testing section)."
  );
  process.exit(1);
}

let supabaseHost;
try {
  supabaseHost = new URL(SUPABASE_URL).hostname;
} catch {
  console.error(`[e2e-seed-vehicle] Invalid SUPABASE_URL: ${SUPABASE_URL}`);
  process.exit(1);
}

if (!["127.0.0.1", "localhost"].includes(supabaseHost)) {
  console.error(`[e2e-seed-vehicle] Refusing to run against non-local SUPABASE_URL: ${SUPABASE_URL}`);
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Fixed VIN so re-runs against a stack that wasn't freshly reset (e.g. local
// dev) upsert the same row instead of accumulating fixtures.
const FIXTURE_VEHICLE = {
  vin: "1FTFW1ET5DFC10312",
  make: "Ford",
  model: "F-150",
  trim: "XLT",
  year: 2022,
  colour: "Blue",
  odometer: 42_000,
  body_type: "truck",
  drive_type: "4wd",
  transmission: "automatic",
  fuel_type: "gasoline",
  description: "E2E fixture vehicle — seeded by scripts/e2e-seed-test-vehicle.mjs for the public listing suite.",
  images_json: ["e2e-fixture/placeholder.jpg"],
  status: "frontline_ready",
};

const { error } = await admin.from("vehicles").upsert(FIXTURE_VEHICLE, { onConflict: "vin" });
if (error) throw new Error(`vehicles upsert(${FIXTURE_VEHICLE.vin}): ${error.message}`);

console.log(`[e2e-seed-vehicle] Seeded fixture vehicle ${FIXTURE_VEHICLE.vin}`);
