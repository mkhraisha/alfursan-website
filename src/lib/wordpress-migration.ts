/**
 * Pure mapping/normalization logic for the one-time WordPress → DMS vehicle
 * inventory migration (docs/WORDPRESS_MIGRATION.md Part 2).
 *
 * Kept separate from src/lib/wordpress.ts (which is Astro-runtime code using
 * import.meta.env) so this module has zero Astro dependency and can be
 * imported directly by the standalone script in scripts/migrate-wordpress-inventory.mjs.
 *
 * Network I/O (fetching WP posts/taxonomy terms, writing to Supabase) lives in
 * the script, not here — everything in this file is a pure function so it can
 * be unit tested without a network or database.
 */

import { vinSchema, BODY_TYPES, DRIVE_TYPES, TRANSMISSIONS, FUEL_TYPES } from "./vehicles.ts";
import type { BodyType, DriveType, Transmission, FuelType } from "./vehicles.ts";

// ── Text normalization helpers ─────────────────────────────────────────────────

export const decodeHtmlEntities = (input: string): string =>
  input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

// WP wraps every block in its own <p>/<div>/<li>/<h1-6> (often with spacer
// paragraphs like "<p>&nbsp;</p>" between sections) — treat those and <br>
// as line breaks rather than flattening the whole post into one run-on line.
const BLOCK_BREAK_TAGS = /<\/(?:p|div|li|h[1-6])>|<br\s*\/?>/gi;

const stripHtmlTags = (input: string): string => input.replace(/<[^>]*>/g, " ");

/**
 * Convert a WP post's rendered HTML content into plain text for the public
 * `description` field, keeping paragraph breaks as blank lines instead of
 * collapsing everything into a single line. The DMS description field is
 * plain text (no HTML), so this is the best fidelity that model supports —
 * see removeCarfaxAnchors()/extractCarfaxLink() for pulling the Carfax
 * report link out into its own dedicated `carfax_link` column instead of
 * leaving dead link text behind.
 */
export const stripHtmlToPlainText = (html: string): string =>
  html
    .replace(BLOCK_BREAK_TAGS, "\n")
    .split("\n")
    .map((line) => decodeHtmlEntities(stripHtmlTags(line)).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");

/** Find the first WordPress content link pointing at a Carfax vehicle history report, if any. */
export const extractCarfaxLink = (html: string): string | undefined => {
  const anchorRe = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html))) {
    const href = decodeHtmlEntities(match[1]);
    if (/carfax\.ca/i.test(href)) return href;
  }
  return undefined;
};

/** Strip Carfax report links out of WP content before flattening to plain text, so no dead link text (e.g. "Carfax Report") is left behind in the description. */
const removeCarfaxAnchors = (html: string): string =>
  html.replace(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>.*?<\/a>/gis, (full, href) =>
    /carfax\.ca/i.test(href) ? "" : full
  );

const slugify = (raw: string): string =>
  raw.trim().toLowerCase().replace(/[\s_-]+/g, "_");

/** Extract the first integer found in a string (e.g. "V6" → 6, "4-Cylinder" → 4). */
export const parseLeadingInt = (raw: string): number | undefined => {
  const match = raw.match(/\d+/);
  if (!match) return undefined;
  const n = parseInt(match[0], 10);
  return Number.isFinite(n) ? n : undefined;
};

// ── Enum term normalization ────────────────────────────────────────────────────
// WP taxonomy term display text ("All Wheel Drive") → canonical DMS enum value.
// Keys are pre-normalized via slugify() before lookup.

const BODY_TYPE_ALIASES: Record<string, BodyType> = {
  sedan: "sedan", van: "van", minivan: "van", mini_van: "van",
  coupe: "coupe", convertible: "convertible", cabriolet: "convertible",
  suv: "suv", crossover: "suv",
  hatchback: "hatchback", hatch: "hatchback",
  truck: "truck", pickup: "truck", pick_up: "truck",
  wagon: "wagon", estate: "wagon",
};

const DRIVE_TYPE_ALIASES: Record<string, DriveType> = {
  fwd: "fwd", front_wheel_drive: "fwd",
  rwd: "rwd", rear_wheel_drive: "rwd",
  awd: "awd", all_wheel_drive: "awd",
  "4wd": "4wd", four_wheel_drive: "4wd", "4x4": "4wd",
  // Some WP listings tag drive type as a combined "AWD/4WD" term rather than
  // picking one — default to AWD (the more common passenger-vehicle term).
  // Confirmed against real WordPress export data; flagged for the dealership
  // to double-check during the real cutover, not just this dry run.
  "awd/4wd": "awd",
};

const TRANSMISSION_ALIASES: Record<string, Transmission> = {
  automatic: "automatic", auto: "automatic", at: "automatic",
  manual: "manual", standard: "manual", stick: "manual", mt: "manual",
  cvt: "cvt", continuously_variable: "cvt", continuously_variable_transmission: "cvt",
};

const FUEL_TYPE_ALIASES: Record<string, FuelType> = {
  gas: "gasoline", gasoline: "gasoline", petrol: "gasoline", regular: "gasoline",
  diesel: "diesel",
  hybrid: "hybrid", phev: "hybrid", plug_in_hybrid: "hybrid",
  electric: "electric", ev: "electric", battery_electric: "electric",
};

function normalizeEnumTerm<T extends string>(
  raw: string | undefined,
  aliases: Record<string, T>,
  validSet: readonly T[]
): T | undefined {
  if (!raw) return undefined;
  const key = slugify(raw);
  // hasOwnProperty guard (not `if (aliases[key])`) — aliases is a plain object
  // literal, so a WP term text that happens to slugify to "constructor" or
  // "__proto__" would otherwise resolve to an inherited Object.prototype
  // value instead of undefined.
  if (Object.prototype.hasOwnProperty.call(aliases, key)) return aliases[key];
  // Fall back to an exact (already-canonical) match, e.g. raw is already "awd"
  return (validSet as readonly string[]).includes(key) ? (key as T) : undefined;
}

export const normalizeBodyType = (raw: string | undefined): BodyType | undefined =>
  normalizeEnumTerm(raw, BODY_TYPE_ALIASES, BODY_TYPES);

export const normalizeDriveType = (raw: string | undefined): DriveType | undefined =>
  normalizeEnumTerm(raw, DRIVE_TYPE_ALIASES, DRIVE_TYPES);

export const normalizeTransmission = (raw: string | undefined): Transmission | undefined =>
  normalizeEnumTerm(raw, TRANSMISSION_ALIASES, TRANSMISSIONS);

export const normalizeFuelType = (raw: string | undefined): FuelType | undefined =>
  normalizeEnumTerm(raw, FUEL_TYPE_ALIASES, FUEL_TYPES);

/** True if a WP "offer type" term (e.g. "Sold", "Available") indicates the vehicle is sold. */
export const isSoldOfferType = (raw: string | undefined): boolean =>
  !!raw && slugify(raw).includes("sold");

// ── Row mapping ────────────────────────────────────────────────────────────────

/** Already taxonomy-resolved fields for a single WP car post — the script resolves term IDs to names before calling this. */
export interface ResolvedWpCarFields {
  wpId: number;
  slug: string;
  vin: string | undefined;
  make: string | undefined;
  model: string | undefined;
  year: string | undefined;
  odometerRaw: string | undefined;
  priceObject: Record<string, number> | undefined;
  bodyTypeRaw: string | undefined;
  driveTypeRaw: string | undefined;
  transmissionRaw: string | undefined;
  fuelTypeRaw: string | undefined;
  cylindersRaw: string | undefined;
  doorsRaw: string | undefined;
  colour: string | undefined;
  features: string[];
  offerTypeRaw: string | undefined;
  htmlDescription: string;
}

export interface MappedVehicleResult {
  vin: string | null;
  /** Insert-ready row for the `vehicles` table, or null if this car must be skipped. */
  row: Record<string, unknown> | null;
  /** Set when row is null — why this car was skipped entirely. */
  skipReason: string | null;
  /** Non-fatal issues — an optional field's raw value didn't map to a known enum, etc. Row is still included. */
  warnings: string[];
}

function toPrice(priceObject: Record<string, number> | undefined): number | undefined {
  if (!priceObject) return undefined;
  const first = Object.values(priceObject)[0];
  return typeof first === "number" ? first : undefined;
}

/**
 * Maps one resolved WP car onto a `vehicles` insert row.
 *
 * Deliberately does NOT set images_json/videos_json (Part 4 migrates photos
 * separately — see docs/WORDPRESS_MIGRATION.md decision 4) or
 * photography_status (stays at its DB default of 'pending', so a migrated
 * vehicle with no photos yet doesn't become publicly visible under Part 3's
 * visibility rule until photos are actually migrated).
 */
export function mapWpCarToVehicleRow(fields: ResolvedWpCarFields): MappedVehicleResult {
  const warnings: string[] = [];
  const blockers: string[] = [];

  const vinCandidate = (fields.vin ?? "").trim().toUpperCase();
  const vinValid = vinSchema.safeParse(vinCandidate).success;
  if (!vinValid) {
    blockers.push(`missing/invalid VIN ("${fields.vin ?? ""}")`);
  }

  const make = fields.make?.trim();
  if (!make) blockers.push("missing make");

  const model = fields.model?.trim();
  if (!model) blockers.push("missing model");

  const year = fields.year ? parseInt(fields.year, 10) : undefined;
  if (!year || !Number.isFinite(year) || year < 1900 || year > 2100) {
    blockers.push(`missing/invalid year ("${fields.year ?? ""}")`);
  }

  const bodyType = normalizeBodyType(fields.bodyTypeRaw);
  if (!bodyType) {
    blockers.push(
      fields.bodyTypeRaw
        ? `unrecognised body type ("${fields.bodyTypeRaw}")`
        : "missing body type"
    );
  }

  // Blocking fields missing — report and stop here, don't bother mapping optional fields.
  if (blockers.length > 0) {
    return {
      vin: vinValid ? vinCandidate : null,
      row: null,
      skipReason: blockers.join("; "),
      warnings,
    };
  }

  const driveType = normalizeDriveType(fields.driveTypeRaw);
  if (fields.driveTypeRaw && !driveType) {
    warnings.push(`unmapped drive_type term "${fields.driveTypeRaw}"`);
  }

  const transmission = normalizeTransmission(fields.transmissionRaw);
  if (fields.transmissionRaw && !transmission) {
    warnings.push(`unmapped transmission term "${fields.transmissionRaw}"`);
  }

  const fuelType = normalizeFuelType(fields.fuelTypeRaw);
  if (fields.fuelTypeRaw && !fuelType) {
    warnings.push(`unmapped fuel_type term "${fields.fuelTypeRaw}"`);
  }

  const cylinders = fields.cylindersRaw ? parseLeadingInt(fields.cylindersRaw) : undefined;
  if (fields.cylindersRaw && cylinders === undefined) {
    warnings.push(`unparseable cylinders term "${fields.cylindersRaw}"`);
  }

  let doors = fields.doorsRaw ? parseLeadingInt(fields.doorsRaw) : undefined;
  if (fields.doorsRaw && (doors === undefined || doors < 2 || doors > 6)) {
    warnings.push(`unparseable/out-of-range doors term "${fields.doorsRaw}"`);
    doors = undefined;
  }

  const odometer = fields.odometerRaw ? parseLeadingInt(fields.odometerRaw.replace(/,/g, "")) : undefined;
  if (fields.odometerRaw && odometer === undefined) {
    warnings.push(`unparseable odometer value "${fields.odometerRaw}"`);
  }

  const carfaxLink = extractCarfaxLink(fields.htmlDescription);
  const description = stripHtmlToPlainText(removeCarfaxAnchors(fields.htmlDescription));
  const features = [...new Set(fields.features.map((f) => f.trim()).filter(Boolean))];
  const status = isSoldOfferType(fields.offerTypeRaw) ? "sold" : "frontline_ready";

  const row: Record<string, unknown> = {
    vin: vinCandidate,
    make,
    model,
    year,
    body_type: bodyType,
    status,
  };
  if (driveType) row.drive_type = driveType;
  if (transmission) row.transmission = transmission;
  if (fuelType) row.fuel_type = fuelType;
  if (cylinders !== undefined) row.cylinders = cylinders;
  if (doors !== undefined) row.doors = doors;
  if (fields.colour?.trim()) row.colour = fields.colour.trim();
  if (odometer !== undefined) row.odometer = odometer;
  if (features.length > 0) row.features = features;
  if (description) row.description = description;
  if (carfaxLink) row.carfax_link = carfaxLink;
  const price = toPrice(fields.priceObject);
  if (price !== undefined) row.advertised_price_cargurus = price;

  return { vin: vinCandidate, row, skipReason: null, warnings };
}

// ── Reconciliation summary ─────────────────────────────────────────────────────

export interface MigrationSummary {
  totalFetched: number;
  /** Candidate rows with no existing VIN match — will be freshly INSERTed. */
  newVehicles: number;
  skipped: number;
  /** Candidate rows whose VIN already exists in the DMS — filled via buildFillPatch(), never skipped outright. */
  matchedExisting: number;
  warningCount: number;
}

export function summarizeMigrationResults(
  results: MappedVehicleResult[],
  existingVins: Set<string>
): MigrationSummary {
  let newVehicles = 0;
  let skipped = 0;
  let matchedExisting = 0;
  let warningCount = 0;

  for (const r of results) {
    warningCount += r.warnings.length;
    if (r.row === null) {
      skipped++;
      continue;
    }
    if (r.vin && existingVins.has(r.vin)) {
      matchedExisting++;
      continue;
    }
    newVehicles++;
  }

  return { totalFetched: results.length, newVehicles, skipped, matchedExisting, warningCount };
}

// ── Fill-in-the-gaps patch for vehicles that already exist in the DMS ──────────

// Fields WordPress can supply that the CSV/OpenLane import sheet never does
// (drive_type, transmission, fuel_type, cylinders, doors, features,
// description, carfax_link — the Carfax report link is embedded as an <a>
// inside the WP post body, not a sheet column), plus the handful of
// overlapping spec fields — filled only when the existing DMS row doesn't
// already have a value. `status` is deliberately excluded: it's
// staff-managed operational state, not vehicle spec data, and this
// migration never touches it on an existing vehicle.
export const FILLABLE_FIELDS = [
  "make", "model", "year", "body_type",
  "drive_type", "transmission", "fuel_type", "cylinders", "doors",
  "colour", "odometer", "features", "description", "advertised_price_cargurus",
  "carfax_link",
] as const;

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Compares an existing `vehicles` row (already in the DMS, e.g. from a CSV
 * import) against a freshly-mapped WordPress row for the same VIN, and
 * returns a patch containing only the fields that are empty on the existing
 * row and populated on the WP side. Never overwrites a field the DMS already
 * has a value for — WP data only fills gaps, it never wins a conflict.
 */
export function buildFillPatch(
  existingRow: Record<string, unknown>,
  mappedRow: Record<string, unknown>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of FILLABLE_FIELDS) {
    if (!(field in mappedRow)) continue; // WP had nothing for this field either
    if (isEmptyValue(existingRow[field])) {
      patch[field] = mappedRow[field];
    }
  }
  return patch;
}

// ── Reconciliation artifacts (skipped/warned/slug→VIN) ─────────────────────────

export interface ReconciliationArtifacts {
  skipped: Array<{ wpId: number | undefined; slug: string | undefined; reason: string | null }>;
  warned: Array<{ vin: string | null; slug: string | undefined; warnings: string[] }>;
  slugToVin: Record<string, string>;
}

/**
 * Pairs each mapped result with its originating WP car (by array position —
 * `results` and `resolved` must be the same length, produced by mapping the
 * same source array) to build the three reconciliation artifacts.
 *
 * Deliberately does a single pass over the original arrays rather than
 * filter().map(): filtering first and then mapping with the filtered
 * array's own index would misalign wpId/slug against the wrong car for
 * every skipped/matched row after the first one removed by the filter.
 */
export function buildReconciliationArtifacts(
  results: MappedVehicleResult[],
  resolved: Array<{ wpId: number; slug: string }>
): ReconciliationArtifacts {
  const skipped: ReconciliationArtifacts["skipped"] = [];
  const warned: ReconciliationArtifacts["warned"] = [];
  const slugToVin: Record<string, string> = {};

  results.forEach((r, i) => {
    const wp = resolved[i];
    if (r.row === null) {
      skipped.push({ wpId: wp?.wpId, slug: wp?.slug, reason: r.skipReason });
    } else if (r.vin) {
      slugToVin[wp?.slug ?? `wp-${wp?.wpId ?? i}`] = r.vin;
    }
    if (r.warnings.length > 0) {
      warned.push({ vin: r.vin, slug: wp?.slug, warnings: r.warnings });
    }
  });

  return { skipped, warned, slugToVin };
}
