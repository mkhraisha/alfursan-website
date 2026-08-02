#!/usr/bin/env node
/**
 * One-time WordPress → DMS vehicle inventory migration
 * (docs/WORDPRESS_MIGRATION.md Part 2).
 *
 * Fetches every vehicle from the WordPress Vehica "cars" custom post type,
 * resolves its taxonomy terms, and maps the result onto the `vehicles` schema
 * via src/lib/wordpress-migration.ts. For a VIN that doesn't exist yet, this
 * INSERTs a new row. For a VIN that already exists (e.g. imported earlier via
 * the CSV importer, which never carries drive_type/transmission/fuel_type/
 * cylinders/doors/features/description), this fills in ONLY the fields that
 * are currently empty on that row — it never overwrites a field the DMS
 * already has a value for, and it never touches `status` (staff-managed
 * operational state, not vehicle spec data). See buildFillPatch().
 * Does NOT touch images_json/videos_json/photography_status — photo
 * migration is Part 4, run separately after this.
 *
 * Local/staging only: refuses to write to a non-local SUPABASE_URL. Reading
 * from WordPress is always safe (read-only, works against production WP).
 *
 * Usage:
 *   node scripts/migrate-wordpress-inventory.mjs --dry-run [--limit=N]
 *   node scripts/migrate-wordpress-inventory.mjs [--limit=N]   # writes to Supabase — requires a local SUPABASE_URL
 *
 * Options:
 *   --dry-run     Fetch + map + validate only. Never writes to Supabase.
 *   --limit=N     Only process the first N WP cars (after fetching all pages).
 *   --wp-api-base=URL  Override the WordPress REST API base (default matches
 *                      src/lib/wordpress.ts: https://media.alfursanauto.ca/wp-json)
 *
 * Output: docs/migration/wordpress-inventory/<timestamp>/
 *   - report.md          human-readable reconciliation report
 *   - report.json         machine-readable version of the same
 *   - slug-to-vin.json    old WP slug → VIN, for Part 5's redirect table
 *   - skipped.json        every skipped row with its reason
 *   - filled.json         every existing vehicle that got 1+ empty field filled in, and which fields
 */

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  mapWpCarToVehicleRow,
  summarizeMigrationResults,
  buildReconciliationArtifacts,
  buildFillPatch,
  FILLABLE_FIELDS,
} from "../src/lib/wordpress-migration.ts";
import { vehicleCreateSchema } from "../src/lib/vehicles.ts";

const DEFAULT_WP_API_BASE = "https://media.alfursanauto.ca/wp-json";

const VEHICA_TAXONOMIES = {
  make: "vehica_6659",
  model: "vehica_6660",
  bodyType: "vehica_6655",
  driveType: "vehica_6661",
  transmission: "vehica_6662",
  fuelType: "vehica_6663",
  cylinders: "vehica_12974",
  colour: "vehica_6666",
  doors: "vehica_12770",
  features: "vehica_6670",
  offerType: "vehica_6657",
  // condition (vehica_6654) deliberately excluded — used cars only, decision 1
};

const CAR_FIELDS = [
  "id", "slug", "date", "content",
  "vehica_6656", // price object
  "vehica_14696", // year
  "vehica_6664", // odometer (km, comma-formatted)
  "vehica_6671", // VIN
  ...Object.values(VEHICA_TAXONOMIES),
].join(",");

// ── CLI args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = (() => {
  const arg = args.find((a) => a.startsWith("--limit="));
  if (!arg) return undefined;
  const n = parseInt(arg.split("=")[1], 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
})();
const WP_API_BASE = (
  args.find((a) => a.startsWith("--wp-api-base="))?.split("=").slice(1).join("=") ??
  process.env.PUBLIC_WP_API_BASE ??
  DEFAULT_WP_API_BASE
).replace(/\/$/, "");

// ── Safety guard — never write to a non-local Supabase project ────────────────

function assertLocalSupabaseOrDryRun(supabaseUrl, serviceKey) {
  if (DRY_RUN) return;
  if (!supabaseUrl) {
    console.error("[migrate] Missing SUPABASE_URL. Run `supabase start` first, or pass --dry-run.");
    process.exit(1);
  }
  if (!serviceKey) {
    console.error("[migrate] Missing SUPABASE_SECRET_KEY. Run `supabase start` first, or pass --dry-run.");
    process.exit(1);
  }
  let hostname;
  try {
    hostname = new URL(supabaseUrl).hostname;
  } catch {
    console.error(`[migrate] Invalid SUPABASE_URL: ${supabaseUrl}`);
    process.exit(1);
  }
  if (!["127.0.0.1", "localhost"].includes(hostname)) {
    console.error(
      `[migrate] Refusing to write to non-local SUPABASE_URL (${supabaseUrl}).\n` +
      "This script only ever writes to a local Supabase stack (`supabase start`).\n" +
      "Use --dry-run to fetch/map/validate without writing anywhere."
    );
    process.exit(1);
  }
}

// ── WordPress fetch helpers ─────────────────────────────────────────────────────

async function fetchTermMap(taxonomy) {
  const map = new Map();
  let page = 1;
  for (;;) {
    const endpoint = `${WP_API_BASE}/wp/v2/${taxonomy}?per_page=100&page=${page}&_fields=id,name`;
    const res = await fetch(endpoint);
    if (!res.ok) {
      // WP returns 400 once page exceeds total pages — normal loop termination.
      if (res.status === 400 && page > 1) break;
      throw new Error(`Fetching taxonomy ${taxonomy} page ${page} failed: HTTP ${res.status}`);
    }
    const terms = await res.json();
    if (terms.length === 0) break;
    for (const t of terms) map.set(t.id, t.name);
    const totalPages = parseInt(res.headers.get("X-WP-TotalPages") ?? "1", 10);
    if (page >= totalPages) break;
    page++;
  }
  return map;
}

async function fetchAllTermMaps() {
  const entries = Object.entries(VEHICA_TAXONOMIES);
  const maps = await Promise.all(entries.map(async ([key, taxonomy]) => [key, await fetchTermMap(taxonomy)]));
  return Object.fromEntries(maps);
}

async function fetchAllCars() {
  const cars = [];
  let page = 1;
  for (;;) {
    const endpoint = `${WP_API_BASE}/wp/v2/cars?per_page=100&page=${page}&_fields=${CAR_FIELDS}`;
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
  return LIMIT ? cars.slice(0, LIMIT) : cars;
}

function getTermName(map, ids) {
  if (!ids?.length) return undefined;
  return map.get(ids[0]);
}

function getTermNames(map, ids) {
  if (!ids?.length) return [];
  return ids.map((id) => map.get(id)).filter(Boolean);
}

function resolveCarFields(car, termMaps) {
  return {
    wpId: car.id,
    slug: car.slug,
    vin: car.vehica_6671,
    make: getTermName(termMaps.make, car.vehica_6659),
    model: getTermName(termMaps.model, car.vehica_6660),
    year: car.vehica_14696,
    odometerRaw: car.vehica_6664,
    priceObject: car.vehica_6656,
    bodyTypeRaw: getTermName(termMaps.bodyType, car.vehica_6655),
    driveTypeRaw: getTermName(termMaps.driveType, car.vehica_6661),
    transmissionRaw: getTermName(termMaps.transmission, car.vehica_6662),
    fuelTypeRaw: getTermName(termMaps.fuelType, car.vehica_6663),
    cylindersRaw: getTermName(termMaps.cylinders, car.vehica_12974),
    doorsRaw: getTermName(termMaps.doors, car.vehica_12770),
    colour: getTermName(termMaps.colour, car.vehica_6666),
    features: getTermNames(termMaps.features, car.vehica_6670),
    offerTypeRaw: getTermName(termMaps.offerType, car.vehica_6657),
    htmlDescription: car.content?.rendered ?? "",
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  assertLocalSupabaseOrDryRun(supabaseUrl, serviceKey);

  console.log(`[migrate] WordPress API base: ${WP_API_BASE}`);
  console.log(`[migrate] Mode: ${DRY_RUN ? "DRY RUN (no writes)" : `WRITE to ${supabaseUrl}`}`);

  console.log("[migrate] Fetching taxonomy terms...");
  const termMaps = await fetchAllTermMaps();

  console.log("[migrate] Fetching WP cars...");
  const cars = await fetchAllCars();
  console.log(`[migrate] Fetched ${cars.length} car(s) from WordPress.`);

  const resolved = cars.map((car) => resolveCarFields(car, termMaps));
  const results = resolved.map((fields) => mapWpCarToVehicleRow(fields));

  // Extra safety net: re-validate every mapped row against the same Zod
  // schema the admin API uses, in case the pure mapper's output ever drifts
  // from what vehicleCreateSchema actually requires.
  for (const r of results) {
    if (!r.row) continue;
    const parsed = vehicleCreateSchema.safeParse(r.row);
    if (!parsed.success) {
      r.row = null;
      r.skipReason = `failed vehicleCreateSchema validation: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`;
    }
  }

  // ── Existing-vehicle lookup + insert/fill (write mode only — dry-run never touches Supabase) ──
  const candidateVins = results.filter((r) => r.row).map((r) => r.vin);
  let existingVins = new Set();
  const insertErrors = [];
  const updateErrors = [];
  const filled = []; // { vin, fields: string[] } — existing vehicles that got 1+ empty field populated
  let insertedCount = 0;
  let unchangedCount = 0;

  if (!DRY_RUN && candidateVins.length > 0) {
    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: existingRows, error } = await db
      .from("vehicles")
      .select(`vin, ${FILLABLE_FIELDS.join(", ")}`)
      .in("vin", candidateVins);
    if (error) throw error;

    const existingByVin = new Map((existingRows ?? []).map((row) => [row.vin, row]));
    existingVins = new Set(existingByVin.keys());

    for (const r of results) {
      if (!r.row) continue;
      const existing = existingByVin.get(r.vin);

      if (!existing) {
        const { error: insertError } = await db.from("vehicles").insert(r.row);
        if (insertError) {
          insertErrors.push({ vin: r.vin, error: insertError.message });
        } else {
          insertedCount++;
        }
        continue;
      }

      const patch = buildFillPatch(existing, r.row);
      const fields = Object.keys(patch);
      if (fields.length === 0) {
        unchangedCount++;
        continue;
      }
      const { error: updateError } = await db.from("vehicles").update(patch).eq("vin", r.vin);
      if (updateError) {
        updateErrors.push({ vin: r.vin, error: updateError.message });
      } else {
        filled.push({ vin: r.vin, fields });
      }
    }
  } else if (DRY_RUN) {
    console.log("[migrate] Dry run — skipping Supabase lookup, insert, and fill entirely.");
  }

  // ── Report ───────────────────────────────────────────────────────────────────
  const summary = summarizeMigrationResults(results, existingVins);
  const { skipped, warned, slugToVin } = buildReconciliationArtifacts(results, resolved);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = `docs/migration/wordpress-inventory/${timestamp}`;
  mkdirSync(outDir, { recursive: true });

  writeFileSync(`${outDir}/slug-to-vin.json`, JSON.stringify(slugToVin, null, 2));
  writeFileSync(`${outDir}/skipped.json`, JSON.stringify(skipped, null, 2));
  writeFileSync(`${outDir}/filled.json`, JSON.stringify(filled, null, 2));
  writeFileSync(
    `${outDir}/report.json`,
    JSON.stringify(
      { ...summary, insertedCount, filledCount: filled.length, unchangedCount, insertErrors, updateErrors, warned, mode: DRY_RUN ? "dry-run" : "write" },
      null,
      2
    )
  );

  const reportMd = [
    `# WordPress inventory migration report`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${DRY_RUN ? "dry-run (no writes)" : "write"}`,
    ``,
    `- Total WP cars fetched: ${summary.totalFetched}`,
    `- Skipped (missing/invalid required data): ${summary.skipped}`,
    DRY_RUN
      ? `- New vehicles (would insert): ${summary.newVehicles}`
      : `- New vehicles inserted: ${insertedCount}`,
    DRY_RUN
      ? `- Already in the DMS (would fill empty fields — not checked in dry run): ${summary.matchedExisting}`
      : `- Already in the DMS: ${summary.matchedExisting} (${filled.length} got 1+ empty field filled in, ${unchangedCount} already complete)`,
    `- Rows with warnings: ${warned.length} (${summary.warningCount} total warnings)`,
    `- Insert errors: ${insertErrors.length}`,
    `- Update (fill) errors: ${updateErrors.length}`,
    ``,
    `See skipped.json for skip reasons, filled.json for which fields were filled on existing vehicles, report.json for warnings/errors, slug-to-vin.json for the old-URL redirect table.`,
  ].join("\n");
  writeFileSync(`${outDir}/report.md`, reportMd);

  console.log(`\n${reportMd}\n`);
  console.log(`[migrate] Full output written to ${outDir}/`);
}

main().catch((err) => {
  console.error("[migrate] Fatal error:", err);
  process.exit(1);
});
