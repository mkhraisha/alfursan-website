/**
 * Pure display-formatting helpers for the public-facing vehicle pages
 * (WordPress migration Part 5): homepage, search, sold, and the individual
 * listing page. All consume the DMS `vehicles` shape (PUBLIC_COLUMNS in
 * src/lib/vehicles.ts) directly instead of WordPress's `CarSummary` — this
 * module fills in the handful of things WordPress used to precompute
 * (a display title, an excerpt, human-readable enum labels, resolved image
 * URLs) that the DMS row doesn't carry itself.
 *
 * Kept framework-agnostic (no Astro/React imports) so it's usable from both
 * `.astro` frontmatter and the React components it feeds.
 */

import { buildStorageUrl } from "./media";

/**
 * Same values as BODY_TYPES in src/lib/vehicles.ts, duplicated here rather
 * than imported from it: vehicles.ts pulls in zod (and everything else it
 * validates), and this module is imported by client-hydrated components
 * (InventoryFilters.tsx) — importing vehicles.ts there would ship the whole
 * server-oriented validation module (zod included) to the browser just for
 * an 8-item dropdown list. Kept in sync via a test that imports both and
 * asserts equality (src/__tests__/public-vehicle-view.test.ts).
 */
export const PUBLIC_BODY_TYPES = [
  "sedan", "van", "coupe", "convertible", "suv", "hatchback", "truck", "wagon",
] as const;

/** The public vehicle shape returned by PUBLIC_COLUMNS (src/lib/vehicles.ts). */
export interface PublicVehicle {
  vin: string;
  make: string | null;
  model: string | null;
  trim: string | null;
  series: string | null;
  year: number | null;
  colour: string | null;
  odometer: number | null;
  body_type: string | null;
  drive_type: string | null;
  transmission: string | null;
  fuel_type: string | null;
  cylinders: number | null;
  doors: number | null;
  features: string[];
  description: string | null;
  advertised_price_cargurus: number | null;
  images_json: string[];
  videos_json: string[];
  carfax_link: string | null;
  created_at: string;
}

/** "2020 Ford Explorer XLT" — WordPress precomputed a post title; the DMS row doesn't carry one. */
export function buildVehicleTitle(
  vehicle: Pick<PublicVehicle, "year" | "make" | "model" | "trim">,
): string {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter((part): part is string | number => Boolean(part))
    .join(" ");
}

/** "$28,000" / "Call for price" — the public-page equivalent of wordpress.ts's formatPrice. */
export function formatVehiclePrice(price: number | null | undefined): string {
  if (typeof price !== "number") {
    return "Call for price";
  }
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(price);
}

/** A short plain-text excerpt for meta descriptions / schema.org, truncated at a word-ish boundary. */
export function buildVehicleExcerpt(
  description: string | null | undefined,
  maxLen = 220,
): string {
  if (!description) return "";
  const flat = description.replace(/\s+/g, " ").trim();
  return flat.length > maxLen ? `${flat.slice(0, maxLen).trimEnd()}…` : flat;
}

/**
 * Capitalizes the first letter only — same convention the admin Basics tab
 * already uses for body_type/transmission/fuel_type option labels
 * (src/components/admin/VehicleDetail.tsx), kept consistent here.
 */
export const capitalizeFirst = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

/** "awd" -> "AWD" — drive types are abbreviations, not words. */
export function driveTypeLabel(value: string | null | undefined): string | undefined {
  return value ? value.toUpperCase() : undefined;
}

export function bodyTypeLabel(value: string | null | undefined): string | undefined {
  return value ? capitalizeFirst(value) : undefined;
}

export function transmissionLabel(value: string | null | undefined): string | undefined {
  return value ? capitalizeFirst(value) : undefined;
}

export function fuelTypeLabel(value: string | null | undefined): string | undefined {
  return value ? capitalizeFirst(value) : undefined;
}

/** Resolves `images_json` storage paths to working public Supabase Storage URLs, in order. */
export function resolveVehicleImageUrls(
  supabaseUrl: string,
  imagesJson: string[] | null | undefined,
): string[] {
  return (imagesJson ?? []).map((path) =>
    buildStorageUrl(supabaseUrl, "vehicle-images", path),
  );
}

/**
 * The shape every public page/component renders from — replaces WordPress's
 * `CarSummary` entirely (doc's stated preference: components consume the DMS
 * shape directly rather than going through a translation layer). Built once
 * per vehicle at the page level via `toDisplayVehicle`.
 */
export interface DisplayVehicle {
  vin: string;
  title: string;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  odometer: number | null;
  bodyType?: string;
  driveType?: string;
  transmission?: string;
  fuelType?: string;
  colour: string | null;
  cylinders: number | null;
  doors: number | null;
  features: string[];
  description: string | null;
  excerpt: string;
  images: string[];
  createdAt: string;
}

export function toDisplayVehicle(
  vehicle: PublicVehicle,
  supabaseUrl: string,
): DisplayVehicle {
  return {
    vin: vehicle.vin,
    title: buildVehicleTitle(vehicle),
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    price: vehicle.advertised_price_cargurus,
    odometer: vehicle.odometer,
    bodyType: bodyTypeLabel(vehicle.body_type),
    driveType: driveTypeLabel(vehicle.drive_type),
    transmission: transmissionLabel(vehicle.transmission),
    fuelType: fuelTypeLabel(vehicle.fuel_type),
    colour: vehicle.colour,
    cylinders: vehicle.cylinders,
    doors: vehicle.doors,
    features: vehicle.features ?? [],
    description: vehicle.description,
    excerpt: buildVehicleExcerpt(vehicle.description),
    images: resolveVehicleImageUrls(supabaseUrl, vehicle.images_json),
    createdAt: vehicle.created_at,
  };
}
