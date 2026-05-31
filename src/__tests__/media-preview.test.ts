import { describe, it, expect } from "vitest";
import { buildStorageUrl, setFeaturedImage, removeImagePath } from "../lib/media";

const BASE = "https://abc.supabase.co";

// ── buildStorageUrl ───────────────────────────────────────────────────────────
// If this function regresses all image thumbnails go blank.

describe("buildStorageUrl", () => {
  it("builds a valid public storage URL", () => {
    const url = buildStorageUrl(BASE, "vehicle-images", "vehicles/VIN/photo.jpg");
    expect(url).toBe(
      "https://abc.supabase.co/storage/v1/object/public/vehicle-images/vehicles/VIN/photo.jpg"
    );
  });

  it("uses the bucket name as-is", () => {
    expect(buildStorageUrl(BASE, "vehicle-documents", "path/file.pdf")).toContain(
      "/vehicle-documents/"
    );
  });

  it("does not produce double-slashes in the path portion", () => {
    const url = buildStorageUrl(BASE, "vehicle-images", "folder/img.jpg");
    // Strip the protocol so `https://` doesn't create a false positive
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    expect(path).not.toMatch(/\/\//);
  });
});

// ── setFeaturedImage ──────────────────────────────────────────────────────────

describe("setFeaturedImage", () => {
  it("moves the chosen path to index 0", () => {
    const result = setFeaturedImage(["a.jpg", "b.jpg", "c.jpg"], "c.jpg");
    expect(result[0]).toBe("c.jpg");
  });

  it("preserves all other paths", () => {
    const result = setFeaturedImage(["a.jpg", "b.jpg", "c.jpg"], "b.jpg");
    expect(result).toHaveLength(3);
    expect(result).toContain("a.jpg");
    expect(result).toContain("c.jpg");
  });

  it("returns the same array reference when path is already first", () => {
    const images = ["a.jpg", "b.jpg"];
    expect(setFeaturedImage(images, "a.jpg")).toBe(images);
  });

  it("does not duplicate the featured path", () => {
    const result = setFeaturedImage(["a.jpg", "b.jpg", "c.jpg"], "b.jpg");
    const count = result.filter((p) => p === "b.jpg").length;
    expect(count).toBe(1);
  });

  it("works on a single-item array", () => {
    const images = ["only.jpg"];
    expect(setFeaturedImage(images, "only.jpg")).toBe(images);
  });
});

// ── removeImagePath ───────────────────────────────────────────────────────────

describe("removeImagePath", () => {
  it("removes the specified path", () => {
    const result = removeImagePath(["a.jpg", "b.jpg", "c.jpg"], "b.jpg");
    expect(result).not.toContain("b.jpg");
  });

  it("preserves all other paths", () => {
    const result = removeImagePath(["a.jpg", "b.jpg", "c.jpg"], "b.jpg");
    expect(result).toEqual(["a.jpg", "c.jpg"]);
  });

  it("returns an empty array when removing the only image", () => {
    expect(removeImagePath(["only.jpg"], "only.jpg")).toEqual([]);
  });

  it("returns unchanged array when path is not found", () => {
    const images = ["a.jpg", "b.jpg"];
    expect(removeImagePath(images, "missing.jpg")).toEqual(images);
  });

  it("removing the featured image promotes the next image (index 0)", () => {
    const result = removeImagePath(["featured.jpg", "next.jpg", "last.jpg"], "featured.jpg");
    expect(result[0]).toBe("next.jpg");
  });
});
