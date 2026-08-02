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
 * Never touches a vehicle whose `images_json` contains a path this script
 * wouldn't itself generate — photo uploads happen only through the DMS going
 * forward (decision 4), so admin-curated photos are never clobbered. A
 * vehicle whose `images_json` is a partial *subset* of what this script would
 * generate (i.e. the leftover of an earlier run where some images failed —
 * downloads/uploads do fail transiently under load) is safely resumed: only
 * the still-missing images are attempted. Each download/upload is retried a
 * few times before being counted as a failure, since most failures of this
 * kind are transient network blips rather than permanent errors. See
 * planVehiclePhotoMigration()/buildFinalImagesJson() in
 * src/lib/wordpress-photo-migration.ts.
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
 * Re-running is always safe: a fully-migrated vehicle is skipped, and a
 * partially-migrated one (some images still missing after a prior run) picks
 * up only the missing images. Just re-run the same command to retry a run
 * that reported per-image errors.
 *
 * Options:
 *   --dry-run           Fetch + plan only. Never downloads, uploads, or writes to Supabase.
 *   --allow-production  Required to write to a non-local SUPABASE_URL. Still prompts for typed confirmation.
 *   --limit=N           Only process the first N WP cars (after fetching all pages).
 *   --vin=VIN           Only process a single VIN (for spot-checking before a full run).
 *   --concurrency=N     Max images downloaded/uploaded in parallel (default 4). Every request already
 *                       forces HTTP/1.1 (see noH2Agent below) to avoid a Node HTTP/2 connection-reuse
 *                       bug that caused sporadic ERR_SSL_ALERT_BAD_RECORD_MAC/ERR_HTTP2_INVALID_SESSION
 *                       failures under concurrency in practice; lowering this further is a reasonable
 *                       thing to try if a run still reports many transient errors, but isn't expected
 *                       to be necessary for the HTTP/2 issue specifically anymore.
 *   --wp-api-base=URL   Override the WordPress REST API base (default: https://media.alfursanauto.ca/wp-json)
 *
 * Output: docs/migration/wordpress-photos/<timestamp>/
 *   - report.md      human-readable summary
 *   - report.json    machine-readable version of the same
 *   - skipped.json   every skipped vehicle with its reason
 *   - migrated.json  every vehicle that got images_json populated/updated this run, and how
 *   - errors.json    per-image download/upload failures (after retries), partial migrations included
 */

import { createClient } from "@supabase/supabase-js";
import { fetch as undiciFetch, Agent } from "undici";
import { mkdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import {
  planVehiclePhotoMigration,
  buildFinalImagesJson,
  buildPhotographyStatusPatch,
} from "../src/lib/wordpress-photo-migration.ts";

const DEFAULT_WP_API_BASE = "https://media.alfursanauto.ca/wp-json";
const STORAGE_BUCKET = "vehicle-images";

// Forces plain HTTP/1.1 for every request this script makes (both the WP
// downloads and the Supabase client below). Observed in a real run: uploads
// were failing with ERR_SSL_ALERT_BAD_RECORD_MAC and
// ERR_HTTP2_INVALID_SESSION under concurrency — Node-core error codes from
// its HTTP/2 stack, not a rate limit or anything about the files themselves
// (a plain database write hit the identical symptom in the same run). HTTP/2
// connection reuse under concurrent load is a known trouble spot; HTTP/1.1
// sidesteps it entirely and is more than fast enough for this one-time
// migration's request volume.
const noH2Agent = new Agent({ allowH2: false });
const fetchH1 = (url, opts) => undiciFetch(url, { ...opts, dispatcher: noH2Agent });

const CONTENT_TYPE_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

// A single image download or upload gets this many attempts total before
// being counted as a failure. "fetch failed" (a bare network/socket error
// with no HTTP status) is almost always transient — a brief retry with
// backoff clears the large majority of them without any operator action.
const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    const res = await fetchH1(endpoint);
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

// ── Retry helper ─────────────────────────────────────────────────────────────
// Wraps a step that returns { ok: true, value } or { ok: false, error } (and
// may also throw on an unexpected network error — caught and treated the
// same as an { ok: false } result) with a few retry attempts and linear
// backoff. Used for both the WP download and the Supabase upload, since
// either can fail with a bare "fetch failed" under transient load.

async function withRetry(attemptFn, label) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let outcome;
    try {
      outcome = await attemptFn();
    } catch (err) {
      outcome = { ok: false, error: describeError(err) };
    }
    if (outcome.ok) return outcome;
    lastError = outcome.error;
    if (attempt < MAX_ATTEMPTS) {
      console.warn(`[migrate-photos] ${label}: attempt ${attempt}/${MAX_ATTEMPTS} failed (${lastError}), retrying...`);
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  return { ok: false, error: lastError };
}

// A bare "fetch failed" (thrown by Node's undici for any network-level
// failure — connection reset, timeout, DNS, TLS, etc.) hides the actual
// cause behind `err.cause`, and Supabase's client wraps that same thrown
// error in `.originalError` on top of its own generic "fetch failed"
// message. Surfacing the real code (e.g. ECONNRESET, UND_ERR_CONNECT_TIMEOUT)
// turns "it failed" into an actionable diagnosis (rate limiting/connection
// resets look very different from a real timeout) instead of a dead end.
function describeError(err) {
  if (!err) return String(err);
  const parts = [err.message ?? String(err)];
  const cause = err.cause ?? err.originalError?.cause;
  if (cause?.code) parts.push(`cause: ${cause.code}`);
  else if (err.originalError?.message && err.originalError.message !== err.message) {
    parts.push(`original: ${err.originalError.message}`);
  }
  return parts.join(" | ");
}

// ── Image download + upload ─────────────────────────────────────────────────────

async function downloadOnce(sourceUrl) {
  const res = await fetchH1(sourceUrl);
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  const buffer = Buffer.from(await res.arrayBuffer());
  return { ok: true, value: { buffer, contentType: res.headers.get("content-type") ?? undefined } };
}

async function uploadOnce(db, storagePath, buffer, contentType) {
  const { error } = await db.storage.from(STORAGE_BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: false,
  });
  if (error) {
    // A retried upload can legitimately hit "the resource already exists":
    // the *previous* attempt's write succeeded server-side even though its
    // response timed out/errored on our end (observed in practice — a
    // Supabase upload can succeed while the client still sees a transient
    // "fetch failed"/timeout). Since storagePath is content-addressed by
    // this vehicle+index (deterministic wp-NN naming, never reused for
    // different content), an "already exists" here means the image we
    // wanted is already there — treat it as success rather than burning
    // through retries and eventually reporting a false failure.
    const alreadyExists = /already exists/i.test(error.message ?? "");
    if (!alreadyExists) return { ok: false, error: describeError(error) };
  }
  return { ok: true, value: undefined };
}

async function downloadAndUpload(db, sourceUrl, storagePath) {
  const downloadResult = await withRetry(() => downloadOnce(sourceUrl), `download ${sourceUrl}`);
  if (!downloadResult.ok) {
    return { ok: false, error: `download failed: ${downloadResult.error}` };
  }

  const { buffer, contentType: fetchedContentType } = downloadResult.value;
  const ext = storagePath.split(".").pop();
  const contentType = fetchedContentType ?? CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";

  const uploadResult = await withRetry(
    () => uploadOnce(db, storagePath, buffer, contentType),
    `upload ${storagePath}`
  );
  if (!uploadResult.ok) {
    return { ok: false, error: `upload failed: ${uploadResult.error}` };
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
    ? createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: fetchH1 },
      })
    : null;

  let vehicles = [];
  if (candidateVins.length > 0) {
    if (DRY_RUN) {
      // Dry run has no DB credentials guaranteed — plan against an empty
      // images_json/photography_status assumption so it still reports what
      // *would* be migrated if nothing has been touched yet. It won't
      // preview a "resume" for a real partially-migrated vehicle; only a
      // real run against Supabase sees that state.
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

  const toAttempt = plans.filter((p) => p.action === "migrate" || p.action === "resume");
  const migrated = []; // { vin, action, newlyUploaded, totalImages, stillMissing, photographyStatusUpdated }
  const errors = []; // { vin, sourceUrl, storagePath, error }
  const failedVehicles = []; // { vin, reason }

  if (DRY_RUN) {
    console.log(`[migrate-photos] Dry run — would migrate ${toAttempt.length} vehicle(s), ${toAttempt.reduce((n, p) => n + p.sourceUrls.length, 0)} image(s) total. Skipping downloads/uploads/writes.`);
  } else {
    for (const plan of toAttempt) {
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
        failedVehicles.push({
          vin: plan.vin,
          reason: plan.action === "resume"
            ? "resume attempted but every remaining image still failed — rerun to retry"
            : "all images failed to download/upload",
        });
        continue;
      }

      const finalImages = buildFinalImagesJson(plan, uploadedPaths);
      const patch = {
        images_json: finalImages,
        ...buildPhotographyStatusPatch(vehicle, uploadedPaths.length),
      };
      // Writing the DB row is just as exposed to the same transient network
      // failures as the image requests above (observed in practice: a run
      // that hit connection trouble mid-way saw this update fail with the
      // same bare "fetch failed" as the storage calls) — retry it too,
      // rather than uploading every image successfully and then losing the
      // result because the one write that persists it wasn't retried.
      const updateResult = await withRetry(
        async () => {
          const { error } = await db.from("vehicles").update(patch).eq("vin", plan.vin);
          return error ? { ok: false, error: describeError(error) } : { ok: true };
        },
        `vehicles update ${plan.vin}`
      );
      if (!updateResult.ok) {
        errors.push({ vin: plan.vin, sourceUrl: null, storagePath: null, error: `vehicles update failed: ${updateResult.error}` });
        continue;
      }

      const stillMissing = plan.order.length - finalImages.length;
      migrated.push({
        vin: plan.vin,
        action: plan.action,
        newlyUploaded: uploadedPaths.length,
        totalImages: finalImages.length,
        stillMissing,
        photographyStatusUpdated: "photography_status" in patch,
      });
      console.log(
        `[migrate-photos] ${plan.vin}: uploaded ${uploadedPaths.length} new image(s) (${finalImages.length}/${plan.order.length} total)` +
        (stillMissing > 0 ? `, ${stillMissing} still missing — rerun to retry.` : ".")
      );
    }
  }

  // ── Report ───────────────────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = `docs/migration/wordpress-photos/${timestamp}`;
  mkdirSync(outDir, { recursive: true });

  writeFileSync(`${outDir}/skipped.json`, JSON.stringify(skipped, null, 2));
  writeFileSync(`${outDir}/migrated.json`, JSON.stringify(migrated, null, 2));
  writeFileSync(`${outDir}/errors.json`, JSON.stringify(errors, null, 2));

  const stillIncompleteCount = migrated.filter((m) => m.stillMissing > 0).length;
  const summary = {
    mode: DRY_RUN ? "dry-run" : "write",
    totalCarsFetched: cars.length,
    candidateVehicles: candidateVins.length,
    notInDms: notInDms.length,
    skipped: skipped.length,
    wouldMigrate: DRY_RUN ? toAttempt.length : undefined,
    migrated: DRY_RUN ? undefined : migrated.length,
    stillIncomplete: DRY_RUN ? undefined : stillIncompleteCount,
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
      ? `- Would migrate: ${toAttempt.length} vehicle(s), ${toAttempt.reduce((n, p) => n + p.sourceUrls.length, 0)} image(s)`
      : `- Migrated/updated: ${migrated.length} vehicle(s) (${migrated.reduce((n, m) => n + m.newlyUploaded, 0)} new image(s) uploaded, ${migrated.filter((m) => m.photographyStatusUpdated).length} flipped to photography_status=done)`,
    DRY_RUN ? "" : `- Still incomplete (some images still missing — rerun to retry): ${stillIncompleteCount}`,
    DRY_RUN ? "" : `- Vehicles with every attempted image failing: ${failedVehicles.length}`,
    `- Per-image errors (after ${MAX_ATTEMPTS} attempts each): ${errors.length}`,
    ``,
    `See skipped.json for skip reasons, migrated.json for per-vehicle upload counts, errors.json for per-image failures, report.json for the full summary.`,
    DRY_RUN ? "" : `Re-running this exact command will retry only what's still missing — already-uploaded images are never re-fetched.`,
  ].filter(Boolean).join("\n");
  writeFileSync(`${outDir}/report.md`, reportMd);

  console.log(`\n${reportMd}\n`);
  console.log(`[migrate-photos] Full output written to ${outDir}/`);
}

main().catch((err) => {
  console.error("[migrate-photos] Fatal error:", err);
  process.exit(1);
});
