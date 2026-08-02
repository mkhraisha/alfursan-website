/**
 * Pure mapping/decision logic for the one-time WordPress → DMS vehicle photo
 * migration (docs/WORDPRESS_MIGRATION.md Part 4).
 *
 * Kept separate from src/lib/wordpress.ts (Astro-runtime, uses
 * import.meta.env) and from src/lib/wordpress-migration.ts (vehicle
 * spec-field mapping, Part 2) so this module has zero Astro dependency and
 * can be imported directly by the standalone script in
 * scripts/migrate-wordpress-photos.mjs. All network I/O (downloading images,
 * uploading to Supabase Storage) lives in the script — everything here is a
 * pure function so it can be unit tested without a network or database.
 */

const MEDIA_DOMAIN = "https://media.alfursanauto.ca";

/** Rewrite any absolute image URL to use the media subdomain (mirrors src/lib/wordpress.ts's toMediaUrl). */
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
  action: "migrate" | "skip";
  reason?: string;
  /** Source WP media URLs to download, in order (index 0 = featured). Empty when action === "skip". */
  sourceUrls: string[];
  /** Destination Supabase Storage paths — same order/length as sourceUrls. */
  storagePaths: string[];
}

/**
 * Decides whether a single vehicle's photos should be migrated, given its
 * current DMS state and the raw WP image URLs found for it.
 *
 * Never re-migrates a vehicle that already has `images_json` populated:
 * photo uploads happen only through the DMS going forward (decision 4 in
 * docs/WORDPRESS_MIGRATION.md), so an admin may have already uploaded/curated
 * photos since Part 2 ran, and this must not clobber that.
 */
export function planVehiclePhotoMigration(
  vehicle: { vin: string; images_json: string[] | null | undefined },
  wpImageUrls: string[],
): VehiclePhotoMigrationPlan {
  if ((vehicle.images_json?.length ?? 0) > 0) {
    return {
      vin: vehicle.vin,
      action: "skip",
      reason: "images_json already populated",
      sourceUrls: [],
      storagePaths: [],
    };
  }

  const dedupedUrls = [...new Set(wpImageUrls.filter(Boolean))];
  if (dedupedUrls.length === 0) {
    return {
      vin: vehicle.vin,
      action: "skip",
      reason: "no WP images found",
      sourceUrls: [],
      storagePaths: [],
    };
  }

  const sourceUrls = dedupedUrls.map(toMediaUrl);
  return {
    vin: vehicle.vin,
    action: "migrate",
    sourceUrls,
    storagePaths: buildVehicleImageStoragePaths(vehicle.vin, sourceUrls),
  };
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
