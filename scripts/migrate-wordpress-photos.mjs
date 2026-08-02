#!/usr/bin/env node
/**
 * One-time WordPress → DMS vehicle photo migration
 * (docs/WORDPRESS_MIGRATION.md Part 4).
 *
 * For every vehicle already in the DMS (typically inserted/filled by Part 2's
 * scripts/migrate-wordpress-inventory.mjs), fetches the matching WP `cars`
 * post's `vehica_6673` image URLs, downloads each one, and uploads it into
 * the Supabase `vehicle-images` bucket at `vehicles/{vin}/wp-NN.{ext}` (same
 * bucket/prefix convention as the admin upload flow in
 * src/pages/api/vehicles/upload-url.ts). `images_json` is then set to the
 * uploaded paths in WP order (index 0 = featured, matching the existing
 * admin convention), and `photography_status` flips from 'pending' to 'done'
 * so the vehicle becomes eligible for Part 3's public-visibility rule.
 *
 * Never touches a vehicle whose `images_json` is already populated — photo
 * uploads happen only through the DMS going forward (decision 4), so this
 * must not clobber photos an admin already curated after Part 2 ran. See
 * planVehiclePhotoMigration() in src/lib/wordpress-photo-migration.ts.
 *
 * Defaults to local/staging only: refuses to write to a non-local
 * SUPABASE_URL unless --allow-production is passed AND you type an exact
 * confirmation phrase at an interactive prompt — same guard as Part 2's
 * script (assertLocalSupabaseOrDryRun). Reading from WordPress is always
 * safe (read-only, works against production WP).
 *
 * Usage:
 *   node scripts/migrate-wordpress-photos.mjs --dry-run [--limit=N]
 *   node scripts/migrate-wordpress-photos.mjs [--limit=N]   # writes — requires a local SUPABASE_URL
 *   node scripts/migrate-wordpress-photos.mjs --allow-production [--limit=N]  # writes to a non-local SUPABASE_URL — prompts for confirmation
 *
 * Options:
 *   --dry-run           Fetch + plan only. Never downloads, uploads, or writes to Supabase.
 *   --allow-production  Required to write to a non-local SUPABASE_URL. Still prompts for typed confirmation.
 *   --limit=N           Only process the first N WP cars (after fetching all pages).
 *   --vin=VIN           Only process a single VIN (for spot-checking before a full run).
 *   --concurrency=N     Max images downloaded/uploaded in parallel (default 4).
 *   --wp-api-base=URL   Override the WordPress REST API base (default: https://media.alfursanauto.ca/wp-json)
 *
 * Output: docs/migration/wordpress-photos/<timestamp>/
 *   - report.md      human-readable summary
 *   - report.json    machine-readable version of the same
 *   - skipped.json   every skipped vehicle with its reason
 *   - migrated.json  every vehicle that got images_json populated, and the storage paths used
 *   - errors.json    per-image download/upload failures (partial migrations included)
 */

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import {
  planVehiclePhotoMigration,
  buildPhotographyStatusPatch,
} from "../src/lib/wordpress-photo-migration.ts";

const DEFAULT_WP_API_BASE = "https://media.alfursanauto.ca/wp-json";
const STORAGE_BUCKET = "vehicle-images";

const CONTENT_TYPE_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

// ── CLI args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ALLOW_PRODUCTION = args.includes("--allow-production");
const LIMIT = (() => {
  const arg = args.find((a) => a.startsWith("--limit="));
  if (!arg) return undefined;
  const n = parseInt(arg.split("=")[1], 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
})();
const ONLY_VIN = args.find((a) => a.startsWith("--vin="))?.split("=").slice(1).join("=")?.trim().toUpperCase();
const CONCURRENCY = (() => {
  const arg = args.find((a) => a.startsWith("--concurrency="));
  const n = arg ? parseInt(arg.split("=")[1], 10) : 4;
  return Number.isFinite(n) && n > 0 ? n : 4;
})();
const WP_API_BASE = (
  args.find((a) => a.startsWith("--wp-api-base="))?.split("=").slice(1).join("=") ??
  process.env.PUBLIC_WP_API_BASE ??
  DEFAULT_WP_API_BASE
).replace(/\/$/, "");

// ── Safety guard — refuses non-local writes unless explicitly + interactively confirmed ──
// (Mirrors scripts/migrate-wordpress-inventory.mjs's guard exactly.)

const PRODUCTION_CONFIRMATION_PHRASE = "yes, write to production";

async function assertLocalSupabaseOrDryRun(supabaseUrl, serviceKey) {
  if (DRY_RUN) return;
  if (!supabaseUrl) {
    console.error("[migrate-photos] Missing SUPABASE_URL. Run `supabase start` first, or pass --dry-run.");
    process.exit(1);
  }
  if (!serviceKey) {
    console.error("[migrate-photos] Missing SUPABASE_SECRET_KEY. Run `supabase start` first, or pass --dry-run.");
    process.exit(1);
  }
  let hostname;
  try {
    hostname = new URL(supabaseUrl).hostname;
  } catch {
    console.error(`[migrate-photos] Invalid SUPABASE_URL: ${supabaseUrl}`);
    process.exit(1);
  }
  if (["127.0.0.1", "localhost"].includes(hostname)) return; // local stack — always fine

  if (!ALLOW_PRODUCTION) {
    console.error(
      `[migrate-photos] Refusing to write to non-local SUPABASE_URL (${supabaseUrl}).\n` +
      "This script only writes to a local Supabase stack (`supabase start`) by default.\n" +
      "Pass --allow-production if you really mean to write to this database (you'll be asked to confirm interactively).\n" +
      "Use --dry-run to fetch/plan without writing anywhere."
    );
    process.exit(1);
  }

  console.warn(
    `\n[migrate-photos] ⚠️  --allow-production is set. This will download WP media and WRITE real data to:\n` +
    `           ${supabaseUrl}\n` +
    `           Double-check this is really the database you mean to touch.\n`
  );
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let answer;
  try {
    answer = await rl.question(`Type "${PRODUCTION_CONFIRMATION_PHRASE}" to continue: `);
  } finally {
    rl.close();
  }
  if (answer.trim() !== PRODUCTION_CONFIRMATION_PHRASE) {
    console.error("[migrate-photos] Confirmation phrase did not match. Aborting — nothing was written.");
    process.exit(1);
  }
  console.log("[migrate-photos] Confirmed. Proceeding with a production write.\n");
}

// ── WordPress fetch ─────────────────────────────────────────────────────────────

async function fetchAllCars() {
  const cars = [];
  let page = 1;
  for (;;) {
    const endpoint = `${WP_API_BASE}/wp/v2/cars?per_page=100&page=${page}&_fields=id,slug,vehica_6671,vehica_6673`;
    const res = await fetch(endpoint);
    if (!res.ok) {
      // WP returns 400 once page exceeds total pages — normal loop termination.
      if (res.status === 400 && page > 1) break;
      throw new Error(`Fetching WP cars page ${page} failed: HTTP ${res.status}`);
    }
    const batch = await res.json();
    if (batch.length === 0) break;
    cars.push(...batch);
    const totalPages = parseInt(res.headers.get("X-WP-TotalPages") ?? "1", 10);
    if (page >= totalPages) break;
    page++;
  }
  return cars;
}

// ── Bounded-concurrency helper ──────────────────────────────────────────────────

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ── Image download + upload ─────────────────────────────────────────────────────

async function downloadAndUpload(db, sourceUrl, storagePath) {
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    return { ok: false, error: `download failed: HTTP ${res.status}` };
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = storagePath.split(".").pop();
  const contentType = res.headers.get("content-type") ?? CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";

  const { error } = await db.storage.from(STORAGE_BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: false,
  });
  if (error) {
    return { ok: false, error: `upload failed: ${error.message}` };
  }
  return { ok: true };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  await assertLocalSupabaseOrDryRun(supabaseUrl, serviceKey);

  console.log(`[migrate-photos] WordPress API base: ${WP_API_BASE}`);
  console.log(`[migrate-photos] Mode: ${DRY_RUN ? "DRY RUN (no downloads/writes)" : `WRITE to ${supabaseUrl}`}`);

  console.log("[migrate-photos] Fetching WP cars...");
  let cars = await fetchAllCars();
  console.log(`[migrate-photos] Fetched ${cars.length} car(s) from WordPress.`);

  const carsByVin = new Map();
  for (const car of cars) {
    const vin = (car.vehica_6671 ?? "").trim().toUpperCase();
    if (!vin) continue;
    carsByVin.set(vin, car);
  }

  let candidateVins = [...carsByVin.keys()];
  if (ONLY_VIN) candidateVins = candidateVins.filter((v) => v === ONLY_VIN);
  if (LIMIT) candidateVins = candidateVins.slice(0, LIMIT);

  const db = !DRY_RUN
    ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  let vehicles = [];
  if (candidateVins.length > 0) {
    if (DRY_RUN) {
      // Dry run has no DB credentials guaranteed — plan against an empty
      // images_json/photography_status assumption so it still reports what
      // *would* be migrated if nothing has been touched yet.
      vehicles = candidateVins.map((vin) => ({ vin, images_json: [], photography_status: "pending" }));
    } else {
      const { data, error } = await db
        .from("vehicles")
        .select("vin, images_json, photography_status")
        .in("vin", candidateVins);
      if (error) throw error;
      vehicles = data ?? [];
    }
  }

  const foundVins = new Set(vehicles.map((v) => v.vin));
  const notInDms = candidateVins.filter((vin) => !foundVins.has(vin));

  const plans = vehicles.map((vehicle) =>
    planVehiclePhotoMigration(vehicle, carsByVin.get(vehicle.vin)?.vehica_6673 ?? [])
  );

  const skipped = plans
    .filter((p) => p.action === "skip")
    .map((p) => ({ vin: p.vin, reason: p.reason }));
  for (const vin of notInDms) {
    skipped.push({ vin, reason: "VIN not found in DMS (Part 2 must run first)" });
  }

  const toMigrate = plans.filter((p) => p.action === "migrate");
  const migrated = []; // { vin, storagePaths, photographyStatusUpdated }
  const errors = []; // { vin, sourceUrl, storagePath, error }
  const failedVehicles = []; // { vin, reason: "all images failed" }

  if (DRY_RUN) {
    console.log(`[migrate-photos] Dry run — would migrate ${toMigrate.length} vehicle(s), ${toMigrate.reduce((n, p) => n + p.sourceUrls.length, 0)} image(s) total. Skipping downloads/uploads/writes.`);
  } else {
    for (const plan of toMigrate) {
      const vehicle = vehicles.find((v) => v.vin === plan.vin);
      const results = await mapWithConcurrency(plan.sourceUrls, CONCURRENCY, (sourceUrl, i) =>
        downloadAndUpload(db, sourceUrl, plan.storagePaths[i])
      );

      const uploadedPaths = [];
      results.forEach((result, i) => {
        if (result.ok) {
          uploadedPaths.push(plan.storagePaths[i]);
        } else {
          errors.push({ vin: plan.vin, sourceUrl: plan.sourceUrls[i], storagePath: plan.storagePaths[i], error: result.error });
        }
      });

      if (uploadedPaths.length === 0) {
        failedVehicles.push({ vin: plan.vin, reason: "all images failed to download/upload" });
        continue;
      }

      const patch = {
        images_json: uploadedPaths,
        ...buildPhotographyStatusPatch(vehicle, uploadedPaths.length),
      };
      const { error: updateError } = await db.from("vehicles").update(patch).eq("vin", plan.vin);
      if (updateError) {
        errors.push({ vin: plan.vin, sourceUrl: null, storagePath: null, error: `vehicles update failed: ${updateError.message}` });
        continue;
      }

      migrated.push({ vin: plan.vin, storagePaths: uploadedPaths, photographyStatusUpdated: "photography_status" in patch });
      console.log(`[migrate-photos] ${plan.vin}: uploaded ${uploadedPaths.length}/${plan.sourceUrls.length} image(s).`);
    }
  }

  // ── Report ───────────────────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = `docs/migration/wordpress-photos/${timestamp}`;
  mkdirSync(outDir, { recursive: true });

  writeFileSync(`${outDir}/skipped.json`, JSON.stringify(skipped, null, 2));
  writeFileSync(`${outDir}/migrated.json`, JSON.stringify(migrated, null, 2));
  writeFileSync(`${outDir}/errors.json`, JSON.stringify(errors, null, 2));

  const summary = {
    mode: DRY_RUN ? "dry-run" : "write",
    totalCarsFetched: cars.length,
    candidateVehicles: candidateVins.length,
    notInDms: notInDms.length,
    skipped: skipped.length,
    wouldMigrate: DRY_RUN ? toMigrate.length : undefined,
    migrated: DRY_RUN ? undefined : migrated.length,
    failedVehicles: DRY_RUN ? undefined : failedVehicles.length,
    imageErrors: errors.length,
  };
  writeFileSync(`${outDir}/report.json`, JSON.stringify({ ...summary, failedVehicles }, null, 2));

  const reportMd = [
    `# WordPress photo migration report`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${DRY_RUN ? "dry-run (no downloads/writes)" : "write"}`,
    ``,
    `- Total WP cars fetched: ${cars.length}`,
    `- Candidate vehicles (WP VIN present): ${candidateVins.length}`,
    `- Not found in DMS: ${notInDms.length}`,
    `- Skipped: ${skipped.length}`,
    DRY_RUN
      ? `- Would migrate: ${toMigrate.length} vehicle(s), ${toMigrate.reduce((n, p) => n + p.sourceUrls.length, 0)} image(s)`
      : `- Migrated: ${migrated.length} vehicle(s) (${migrated.reduce((n, m) => n + m.storagePaths.length, 0)} image(s) uploaded, ${migrated.filter((m) => m.photographyStatusUpdated).length} flipped to photography_status=done)`,
    DRY_RUN ? "" : `- Vehicles with every image failing: ${failedVehicles.length}`,
    `- Per-image errors: ${errors.length}`,
    ``,
    `See skipped.json for skip reasons, migrated.json for uploaded paths per vehicle, errors.json for per-image failures, report.json for the full summary.`,
  ].filter(Boolean).join("\n");
  writeFileSync(`${outDir}/report.md`, reportMd);

  console.log(`\n${reportMd}\n`);
  console.log(`[migrate-photos] Full output written to ${outDir}/`);
}

main().catch((err) => {
  console.error("[migrate-photos] Fatal error:", err);
  process.exit(1);
});
