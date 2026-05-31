/**
 * Build a Supabase Storage public URL for displaying a vehicle media file.
 * This is the URL every <img> in the media tab uses — if it regresses,
 * all thumbnails go blank.
 */
export function buildStorageUrl(supabaseUrl: string, bucket: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Move `path` to index 0 of `images` (making it the featured image).
 * Returns the original array unchanged if `path` is already first.
 */
export function setFeaturedImage(images: string[], path: string): string[] {
  if (images[0] === path) return images;
  return [path, ...images.filter((p) => p !== path)];
}

/**
 * Remove `path` from `images`.
 */
export function removeImagePath(images: string[], path: string): string[] {
  return images.filter((p) => p !== path);
}
