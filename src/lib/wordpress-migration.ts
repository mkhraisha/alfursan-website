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
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const stripHtmlTags = (input: string): string =>
  input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** Convert a WP post's rendered HTML content into plain text for the public `description` field. */
export const stripHtmlToPlainText = (html: string): string =>
  decodeHtmlEntities(stripHtmlTags(html));

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
  if (aliases[key]) return aliases[key];
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

  const description = stripHtmlToPlainText(fields.htmlDescription);
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
  const price = toPrice(fields.priceObject);
  if (price !== undefined) row.advertised_price_cargurus = price;

  return { vin: vinCandidate, row, skipReason: null, warnings };
}

// ── Reconciliation summary ─────────────────────────────────────────────────────

export interface MigrationSummary {
  totalFetched: number;
  migrated: number;
  skipped: number;
  collisions: number;
  warningCount: number;
}

export function summarizeMigrationResults(
  results: MappedVehicleResult[],
  collisionVins: Set<string>
): MigrationSummary {
  let migrated = 0;
  let skipped = 0;
  let collisions = 0;
  let warningCount = 0;

  for (const r of results) {
    warningCount += r.warnings.length;
    if (r.row === null) {
      skipped++;
      continue;
    }
    if (r.vin && collisionVins.has(r.vin)) {
      collisions++;
      continue;
    }
    migrated++;
  }

  return { totalFetched: results.length, migrated, skipped, collisions, warningCount };
}
