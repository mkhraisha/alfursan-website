/**
 * Pure mapping/decision logic for the one-time WordPress → DMS vehicle photo
 * migration (docs/WORDPRESS_MIGRATION.md Part 4).
 *
 * Kept separate from src/lib/wordpress-migration.ts (vehicle spec-field
 * mapping, Part 2) so this module has zero Astro dependency and
 * can be imported directly by the standalone script in
 * scripts/migrate-wordpress-photos.mjs. All network I/O (downloading images,
 * uploading to Supabase Storage) lives in the script — everything here is a
 * pure function so it can be unit tested without a network or database.
 */

const MEDIA_DOMAIN = "https://media.alfursanauto.ca";

/** Rewrite any absolute image URL to use the media subdomain. */
export const toMediaUrl = (url: string): string =>
  url.replace(/^https?:\/\/alfursanauto\.ca(?=\/)/i, MEDIA_DOMAIN);

const KNOWN_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];

/** Extract a lowercase file extension from an image URL, defaulting to "jpg" when absent or unrecognized. */
export function getFileExtension(url: string): string {
  const pathname = url.split(/[?#]/)[0];
  const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
  const ext = match?.[1]?.toLowerCase();
  return ext && KNOWN_IMAGE_EXTENSIONS.includes(ext) ? ext : "jpg";
}

/**
 * Builds the ordered Supabase Storage paths for a vehicle's migrated images —
 * same `vehicles/{vin}/...` prefix the admin upload flow uses
 * (src/pages/api/vehicles/upload-url.ts). Order is preserved: index 0 is the
 * WP-designated featured image, matching the existing admin convention that
 * the first path in `images_json` is the featured image.
 */
export function buildVehicleImageStoragePaths(
  vin: string,
  urls: string[],
): string[] {
  return urls.map(
    (url, index) =>
      `vehicles/${vin}/wp-${String(index).padStart(2, "0")}.${getFileExtension(url)}`,
  );
}

export interface VehiclePhotoMigrationPlan {
  vin: string;
  action: "migrate" | "resume" | "skip";
  reason?: string;
  /** Paths already present in images_json and left untouched — kept as-is in the final result. */
  existingPaths: string[];
  /** Source WP media URLs still needing download+upload, in order. Empty when action === "skip". */
  sourceUrls: string[];
  /** Destination Supabase Storage paths for sourceUrls — same order/length. */
  storagePaths: string[];
  /**
   * The fully-migrated, WP-ordered path list this vehicle would end up with
   * if every entry in sourceUrls/storagePaths uploads successfully
   * (existingPaths ∪ storagePaths, in WP order). For "skip" this equals the
   * vehicle's current images_json unchanged.
   */
  order: string[];
}

function skipPlan(
  vin: string,
  reason: string,
  existingPaths: string[],
): VehiclePhotoMigrationPlan {
  return {
    vin,
    action: "skip",
    reason,
    existingPaths,
    sourceUrls: [],
    storagePaths: [],
    order: existingPaths,
  };
}

/**
 * Decides whether a single vehicle's photos should be migrated, given its
 * current DMS state and the raw WP image URLs found for it.
 *
 * Three outcomes:
 * - "migrate": images_json is empty — download+upload every WP image.
 * - "resume": images_json is non-empty, but every path in it is one this
 *   script would itself generate for this vehicle from the current WP data
 *   (the `vehicles/{vin}/wp-NN.ext` pattern) — meaning it's the leftover
 *   result of an earlier run that partially failed (e.g. transient upload
 *   errors), not admin-curated photos. Only the still-missing images are
 *   downloaded/uploaded; already-present ones are left alone.
 * - "skip": either images_json contains a path this script wouldn't have
 *   generated (an admin uploaded/curated a photo — photo uploads happen only
 *   through the DMS going forward, decision 4 in docs/WORDPRESS_MIGRATION.md,
 *   so this must never be clobbered), the vehicle is already fully migrated,
 *   or there are no WP images to migrate at all.
 */
export function planVehiclePhotoMigration(
  vehicle: { vin: string; images_json: string[] | null | undefined },
  wpImageUrls: string[],
): VehiclePhotoMigrationPlan {
  const existing = vehicle.images_json ?? [];

  const dedupedUrls = [...new Set(wpImageUrls.filter(Boolean))];
  const fullSourceUrls = dedupedUrls.map(toMediaUrl);
  const fullStoragePaths = buildVehicleImageStoragePaths(
    vehicle.vin,
    fullSourceUrls,
  );

  if (existing.length === 0) {
    if (fullStoragePaths.length === 0) {
      return skipPlan(vehicle.vin, "no WP images found", existing);
    }
    return {
      vin: vehicle.vin,
      action: "migrate",
      existingPaths: [],
      sourceUrls: fullSourceUrls,
      storagePaths: fullStoragePaths,
      order: fullStoragePaths,
    };
  }

  const fullPathSet = new Set(fullStoragePaths);
  const allScriptAuthored = existing.every((p) => fullPathSet.has(p));
  if (!allScriptAuthored) {
    return skipPlan(vehicle.vin, "images_json already populated", existing);
  }

  const missingPaths = fullStoragePaths.filter((p) => !existing.includes(p));
  if (missingPaths.length === 0) {
    return skipPlan(vehicle.vin, "already fully migrated", existing);
  }

  const missingSourceUrls = missingPaths.map(
    (p) => fullSourceUrls[fullStoragePaths.indexOf(p)],
  );

  return {
    vin: vehicle.vin,
    action: "resume",
    existingPaths: existing,
    sourceUrls: missingSourceUrls,
    storagePaths: missingPaths,
    order: fullStoragePaths,
  };
}

/**
 * Builds the final `images_json` value to write after a migration/resume
 * attempt: `plan.order` (the correct WP-ordered full path list) filtered down
 * to only the paths that are either already-existing or were just uploaded
 * successfully this run — so a still-failing image is excluded rather than
 * silently included, and the WP-designated order is preserved either way.
 */
export function buildFinalImagesJson(
  plan: VehiclePhotoMigrationPlan,
  uploadedPaths: string[],
): string[] {
  const known = new Set([...plan.existingPaths, ...uploadedPaths]);
  return plan.order.filter((p) => known.has(p));
}

/**
 * After a photo migration attempt, decides whether `photography_status`
 * should flip to 'done'. Only applies when at least one image uploaded
 * successfully and the field is still unset or at its 'pending' default —
 * never overrides a staff-set 'na' (no photos needed) or an already-'done'
 * value.
 */
export function buildPhotographyStatusPatch(
  vehicle: { photography_status: string | null | undefined },
  uploadedCount: number,
): Record<string, unknown> {
  if (uploadedCount === 0) return {};
  if (vehicle.photography_status && vehicle.photography_status !== "pending") {
    return {};
  }
  return { photography_status: "done" };
}
