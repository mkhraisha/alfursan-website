#!/usr/bin/env node
/**
 * One-time cleanup for `vehicles.description` text migrated from WordPress.
 *
 * Most migrated descriptions end with a dealership-wide "Visit Us" /
 * certification-price / "Our Promise" section, reworded slightly across
 * listings but otherwise identical — the biggest single source of "most of
 * our car descriptions read the same". That content now lives once,
 * statically, on the listing page template (src/pages/listing/[vin].astro),
 * sourced from CONTACT_INFO/ALFURSAN_PROMISE — so it's removed from
 * `description` here.
 *
 * Three phases:
 *  1. Strip (always runs, no API key needed) — src/lib/vehicle-description.ts's
 *     stripDealerBoilerplate() removes only the recurring dealer-boilerplate
 *     paragraphs from each description, leaving every other paragraph exactly
 *     as-is. Some descriptions interleave a *mandatory OMVIC disclosure*
 *     ("this vehicle is being sold as unfit...") with that same trailing
 *     section — stripDealerBoilerplate() preserves any paragraph mentioning
 *     OMVIC/"sold as unfit" even while removing the generic boilerplate around
 *     it, since that's per-vehicle legal content, not marketing copy. Vehicles
 *     containing such a disclosure are still reported separately
 *     (omvic-review.json) so staff can spot-check nothing legally relevant
 *     was affected.
 *  2. Find remaining duplicates — runs findDuplicateDescriptionGroups() on the
 *     *post-strip* text to catch any genuinely car-specific-but-still-shared
 *     leftovers.
 *  3. (optional, --generate, requires GEMINI_API_KEY) for every VIN in a
 *     still-duplicated group, calls generateVehicleDescription() via the
 *     Gemini API and proposes a fresh, car-specific replacement.
 *
 * Defaults to dry-run (report only, no writes). --apply writes the stripped
 * (and, with --generate, regenerated) descriptions back to Supabase, gated by
 * the same local-only + --allow-production confirmation guard as
 * scripts/migrate-wordpress-inventory.mjs — refuses a non-local SUPABASE_URL
 * unless --allow-production is passed AND you type an exact confirmation
 * phrase at an interactive prompt.
 *
 * Usage:
 *   node scripts/clean-vehicle-descriptions.mjs                     # dry run, report only
 *   node scripts/clean-vehicle-descriptions.mjs --apply              # writes to a local Supabase stack
 *   node scripts/clean-vehicle-descriptions.mjs --apply --generate    # also regenerates still-duplicated descriptions via Gemini
 *   node scripts/clean-vehicle-descriptions.mjs --apply --allow-production  # writes to a non-local DB — prompts for confirmation
 *
 * Output: docs/migration/clean-vehicle-descriptions/<timestamp>/
 *   - report.md / report.json
 *   - stripped.json             every VIN whose description changed after stripping, old + new
 *   - omvic-review.json         VINs whose description contains a mandatory OMVIC disclosure — spot-check these
 *   - remaining-duplicates.json duplicate groups found in the post-strip text
 *   - generated.json            (only with --generate) VINs whose description was regenerated, old + new
 */

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import {
  stripDealerBoilerplate,
  containsMandatoryDisclosure,
  findDuplicateDescriptionGroups,
  generateVehicleDescription,
} from "../src/lib/vehicle-description.ts";

const SPEC_COLUMNS =
  "vin, description, make, model, year, trim, series, body_type, colour, odometer, drive_type, transmission, fuel_type, cylinders, doors, engine_type, features";

// ── CLI args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const GENERATE = args.includes("--generate");
const ALLOW_PRODUCTION = args.includes("--allow-production");

// ── Safety guard — refuses non-local writes unless explicitly + interactively confirmed ──

const PRODUCTION_CONFIRMATION_PHRASE = "yes, write to production";

async function assertLocalSupabaseOrDryRun(supabaseUrl, serviceKey) {
  if (!APPLY) return;
  if (!supabaseUrl) {
    console.error("[clean] Missing SUPABASE_URL. Run `supabase start` first, or drop --apply for a dry run.");
    process.exit(1);
  }
  if (!serviceKey) {
    console.error("[clean] Missing SUPABASE_SECRET_KEY. Run `supabase start` first, or drop --apply for a dry run.");
    process.exit(1);
  }
  let hostname;
  try {
    hostname = new URL(supabaseUrl).hostname;
  } catch {
    console.error(`[clean] Invalid SUPABASE_URL: ${supabaseUrl}`);
    process.exit(1);
  }
  if (["127.0.0.1", "localhost"].includes(hostname)) return; // local stack — always fine

  if (!ALLOW_PRODUCTION) {
    console.error(
      `[clean] Refusing to write to non-local SUPABASE_URL (${supabaseUrl}).\n` +
      "This script only writes to a local Supabase stack (`supabase start`) by default.\n" +
      "Pass --allow-production if you really mean to write to this database (you'll be asked to confirm interactively).\n" +
      "Drop --apply to report without writing anywhere."
    );
    process.exit(1);
  }

  console.warn(
    `\n[clean] ⚠️  --allow-production is set. This will WRITE real data to:\n` +
    `         ${supabaseUrl}\n` +
    `         Double-check this is really the database you mean to touch.\n`
  );
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let answer;
  try {
    answer = await rl.question(`Type "${PRODUCTION_CONFIRMATION_PHRASE}" to continue: `);
  } finally {
    rl.close();
  }
  if (answer.trim() !== PRODUCTION_CONFIRMATION_PHRASE) {
    console.error("[clean] Confirmation phrase did not match. Aborting — nothing was written.");
    process.exit(1);
  }
  console.log("[clean] Confirmed. Proceeding with a production write.\n");
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  await assertLocalSupabaseOrDryRun(supabaseUrl, serviceKey);

  console.log(`[clean] Mode: ${APPLY ? `WRITE to ${supabaseUrl}` : "DRY RUN (no writes)"}${GENERATE ? " + generate" : ""}`);

  const db = createClient(supabaseUrl ?? "http://127.0.0.1:54321", serviceKey ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: vehicles, error } = await db
    .from("vehicles")
    .select(SPEC_COLUMNS)
    .not("description", "is", null);
  if (error) throw error;

  console.log(`[clean] ${vehicles.length} vehicle(s) with a description.`);

  // ── Phase 1: strip ──────────────────────────────────────────────────────────
  const stripped = []; // { vin, before, after }
  const omvicReview = []; // vins
  const strippedByVin = new Map(); // vin -> post-strip description (for phase 2)

  for (const v of vehicles) {
    const before = v.description;
    if (containsMandatoryDisclosure(before)) omvicReview.push(v.vin);

    const after = stripDealerBoilerplate(before);
    strippedByVin.set(v.vin, after);
    if (after !== before) stripped.push({ vin: v.vin, before, after });
  }

  console.log(`[clean] ${stripped.length} description(s) changed after stripping dealer boilerplate.`);
  console.log(`[clean] ${omvicReview.length} vehicle(s) contain a mandatory OMVIC disclosure — spot-check these.`);

  const stripErrors = [];
  if (APPLY) {
    for (const s of stripped) {
      const { error: updateError } = await db
        .from("vehicles")
        .update({ description: s.after || null })
        .eq("vin", s.vin);
      if (updateError) stripErrors.push({ vin: s.vin, error: updateError.message });
    }
  }

  // ── Phase 2: duplicate detection on the post-strip text ──────────────────────
  const postStrip = vehicles.map((v) => ({ vin: v.vin, description: strippedByVin.get(v.vin) }));
  const duplicateGroups = findDuplicateDescriptionGroups(postStrip);
  const duplicateVehicleCount = duplicateGroups.reduce((n, g) => n + g.vins.length, 0);
  console.log(`[clean] ${duplicateGroups.length} duplicate group(s) remain after stripping (${duplicateVehicleCount} vehicle(s)).`);

  // ── Phase 3: optional regeneration for still-duplicated vehicles ────────────
  const generated = []; // { vin, before, after }
  const generateErrors = [];
  if (GENERATE) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[clean] --generate requires GEMINI_API_KEY to be set — skipping regeneration.");
    } else {
      const byVin = new Map(vehicles.map((v) => [v.vin, v]));
      for (const group of duplicateGroups) {
        for (const vin of group.vins) {
          const vehicle = byVin.get(vin);
          try {
            const after = await generateVehicleDescription(vehicle, {
              apiKey,
              model: process.env.GEMINI_MODEL || undefined,
            });
            generated.push({ vin, before: strippedByVin.get(vin), after });
            if (APPLY) {
              const { error: updateError } = await db.from("vehicles").update({ description: after }).eq("vin", vin);
              if (updateError) generateErrors.push({ vin, error: updateError.message });
            }
          } catch (err) {
            generateErrors.push({ vin, error: err instanceof Error ? err.message : String(err) });
          }
        }
      }
      console.log(`[clean] ${generated.length} description(s) regenerated via Gemini.`);
    }
  }

  // ── Report ───────────────────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = `docs/migration/clean-vehicle-descriptions/${timestamp}`;
  mkdirSync(outDir, { recursive: true });

  writeFileSync(`${outDir}/stripped.json`, JSON.stringify(stripped, null, 2));
  writeFileSync(`${outDir}/omvic-review.json`, JSON.stringify(omvicReview, null, 2));
  writeFileSync(`${outDir}/remaining-duplicates.json`, JSON.stringify(duplicateGroups, null, 2));
  writeFileSync(`${outDir}/generated.json`, JSON.stringify(generated, null, 2));
  writeFileSync(
    `${outDir}/report.json`,
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        generate: GENERATE,
        totalWithDescription: vehicles.length,
        strippedCount: stripped.length,
        omvicReviewCount: omvicReview.length,
        remainingDuplicateGroups: duplicateGroups.length,
        remainingDuplicateVehicles: duplicateVehicleCount,
        generatedCount: generated.length,
        stripErrors,
        generateErrors,
      },
      null,
      2
    )
  );

  const reportMd = [
    `# Vehicle description cleanup report`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${APPLY ? "apply (writes)" : "dry-run (no writes)"}${GENERATE ? " + generate" : ""}`,
    ``,
    `- Vehicles with a description: ${vehicles.length}`,
    `- Descriptions changed after stripping dealer boilerplate: ${stripped.length}`,
    `- Vehicles containing a mandatory OMVIC disclosure (spot-check these): ${omvicReview.length}`,
    `- Duplicate groups remaining after stripping: ${duplicateGroups.length} (${duplicateVehicleCount} vehicles)`,
    GENERATE ? `- Descriptions regenerated via Gemini: ${generated.length}` : null,
    stripErrors.length > 0 ? `- Strip write errors: ${stripErrors.length}` : null,
    generateErrors.length > 0 ? `- Generate write errors: ${generateErrors.length}` : null,
    ``,
    `See stripped.json for before/after text, omvic-review.json for VINs to spot-check, remaining-duplicates.json for still-duplicated groups${GENERATE ? ", generated.json for before/after regenerated text" : ""}.`,
  ]
    .filter((line) => line !== null)
    .join("\n");
  writeFileSync(`${outDir}/report.md`, reportMd);

  console.log(`\n${reportMd}\n`);
  console.log(`[clean] Full output written to ${outDir}/`);
}

main().catch((err) => {
  console.error("[clean] Fatal error:", err);
  process.exit(1);
});
