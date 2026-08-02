import { describe, it, expect } from "vitest";
import {
  toMediaUrl,
  getFileExtension,
  buildVehicleImageStoragePaths,
  planVehiclePhotoMigration,
  buildFinalImagesJson,
  buildPhotographyStatusPatch,
} from "../lib/wordpress-photo-migration";

describe("toMediaUrl", () => {
  it("rewrites alfursanauto.ca URLs to the media subdomain", () => {
    expect(toMediaUrl("https://alfursanauto.ca/wp-content/uploads/car.jpg")).toBe(
      "https://media.alfursanauto.ca/wp-content/uploads/car.jpg",
    );
  });

  it("leaves an already-media URL unchanged", () => {
    const url = "https://media.alfursanauto.ca/wp-content/uploads/car.jpg";
    expect(toMediaUrl(url)).toBe(url);
  });

  it("leaves an unrelated host unchanged", () => {
    const url = "https://example.com/car.jpg";
    expect(toMediaUrl(url)).toBe(url);
  });
});

describe("getFileExtension", () => {
  it("extracts a known extension", () => {
    expect(getFileExtension("https://media.alfursanauto.ca/car.png")).toBe("png");
  });

  it("lowercases the extension", () => {
    expect(getFileExtension("https://media.alfursanauto.ca/car.JPG")).toBe("jpg");
  });

  it("strips query strings before matching", () => {
    expect(getFileExtension("https://media.alfursanauto.ca/car.webp?w=800")).toBe(
      "webp",
    );
  });

  it("defaults to jpg when there is no extension", () => {
    expect(getFileExtension("https://media.alfursanauto.ca/car")).toBe("jpg");
  });

  it("defaults to jpg for an unrecognized extension", () => {
    expect(getFileExtension("https://media.alfursanauto.ca/car.bmp")).toBe("jpg");
  });
});

describe("buildVehicleImageStoragePaths", () => {
  it("builds ordered vehicles/{vin}/... paths preserving input order", () => {
    const paths = buildVehicleImageStoragePaths("1HGCM82633A123456", [
      "https://media.alfursanauto.ca/a.jpg",
      "https://media.alfursanauto.ca/b.png",
    ]);
    expect(paths).toEqual([
      "vehicles/1HGCM82633A123456/wp-00.jpg",
      "vehicles/1HGCM82633A123456/wp-01.png",
    ]);
  });

  it("returns an empty array for no urls", () => {
    expect(buildVehicleImageStoragePaths("1HGCM82633A123456", [])).toEqual([]);
  });
});

describe("planVehiclePhotoMigration", () => {
  const vin = "1HGCM82633A123456";

  it("skips a vehicle whose images_json contains a non-script path (admin-curated)", () => {
    const plan = planVehiclePhotoMigration(
      { vin, images_json: ["vehicles/1HGCM82633A123456/existing.jpg"] },
      ["https://alfursanauto.ca/a.jpg"],
    );
    expect(plan).toEqual({
      vin,
      action: "skip",
      reason: "images_json already populated",
      existingPaths: ["vehicles/1HGCM82633A123456/existing.jpg"],
      sourceUrls: [],
      storagePaths: [],
      order: ["vehicles/1HGCM82633A123456/existing.jpg"],
    });
  });

  it("skips a vehicle with no WP images", () => {
    const plan = planVehiclePhotoMigration({ vin, images_json: [] }, []);
    expect(plan.action).toBe("skip");
    expect(plan.reason).toBe("no WP images found");
  });

  it("skips when images_json is null and there are no WP images", () => {
    const plan = planVehiclePhotoMigration({ vin, images_json: null }, []);
    expect(plan.action).toBe("skip");
  });

  it("migrates when images_json is null and WP images exist", () => {
    const plan = planVehiclePhotoMigration({ vin, images_json: null }, [
      "https://alfursanauto.ca/a.jpg",
    ]);
    expect(plan.action).toBe("migrate");
  });

  it("migrates a vehicle with empty images_json and WP images, resolving to media URLs", () => {
    const plan = planVehiclePhotoMigration(
      { vin, images_json: [] },
      [
        "https://alfursanauto.ca/a.jpg",
        "https://alfursanauto.ca/b.png",
      ],
    );
    expect(plan.action).toBe("migrate");
    expect(plan.existingPaths).toEqual([]);
    expect(plan.sourceUrls).toEqual([
      "https://media.alfursanauto.ca/a.jpg",
      "https://media.alfursanauto.ca/b.png",
    ]);
    expect(plan.storagePaths).toEqual([
      `vehicles/${vin}/wp-00.jpg`,
      `vehicles/${vin}/wp-01.png`,
    ]);
    expect(plan.order).toEqual(plan.storagePaths);
  });

  it("dedupes repeated WP image urls while preserving first-seen order", () => {
    const plan = planVehiclePhotoMigration(
      { vin, images_json: [] },
      [
        "https://alfursanauto.ca/a.jpg",
        "https://alfursanauto.ca/b.png",
        "https://alfursanauto.ca/a.jpg",
      ],
    );
    expect(plan.sourceUrls).toEqual([
      "https://media.alfursanauto.ca/a.jpg",
      "https://media.alfursanauto.ca/b.png",
    ]);
  });

  it("filters out falsy urls", () => {
    const plan = planVehiclePhotoMigration(
      { vin, images_json: [] },
      ["https://alfursanauto.ca/a.jpg", "", undefined as unknown as string],
    );
    expect(plan.sourceUrls).toEqual(["https://media.alfursanauto.ca/a.jpg"]);
  });

  it("resumes a partially-migrated vehicle, fetching only the missing script-authored paths", () => {
    // First image (wp-00) already uploaded by an earlier, partially-failed run.
    const plan = planVehiclePhotoMigration(
      { vin, images_json: [`vehicles/${vin}/wp-00.jpg`] },
      [
        "https://alfursanauto.ca/a.jpg",
        "https://alfursanauto.ca/b.png",
        "https://alfursanauto.ca/c.webp",
      ],
    );
    expect(plan.action).toBe("resume");
    expect(plan.existingPaths).toEqual([`vehicles/${vin}/wp-00.jpg`]);
    expect(plan.sourceUrls).toEqual([
      "https://media.alfursanauto.ca/b.png",
      "https://media.alfursanauto.ca/c.webp",
    ]);
    expect(plan.storagePaths).toEqual([
      `vehicles/${vin}/wp-01.png`,
      `vehicles/${vin}/wp-02.webp`,
    ]);
    expect(plan.order).toEqual([
      `vehicles/${vin}/wp-00.jpg`,
      `vehicles/${vin}/wp-01.png`,
      `vehicles/${vin}/wp-02.webp`,
    ]);
  });

  it("skips a vehicle that is already fully migrated (all script-authored paths present)", () => {
    const plan = planVehiclePhotoMigration(
      { vin, images_json: [`vehicles/${vin}/wp-00.jpg`, `vehicles/${vin}/wp-01.png`] },
      ["https://alfursanauto.ca/a.jpg", "https://alfursanauto.ca/b.png"],
    );
    expect(plan.action).toBe("skip");
    expect(plan.reason).toBe("already fully migrated");
  });

  it("skips (never resumes) if even one existing path isn't script-authored, even alongside script-authored ones", () => {
    const plan = planVehiclePhotoMigration(
      {
        vin,
        images_json: [
          `vehicles/${vin}/wp-00.jpg`,
          `vehicles/${vin}/admin-uploaded-uuid.jpg`,
        ],
      },
      ["https://alfursanauto.ca/a.jpg", "https://alfursanauto.ca/b.png"],
    );
    expect(plan.action).toBe("skip");
    expect(plan.reason).toBe("images_json already populated");
  });
});

describe("buildFinalImagesJson", () => {
  const vin = "1HGCM82633A123456";

  it("returns the full order when every upload succeeds", () => {
    const plan = planVehiclePhotoMigration({ vin, images_json: [] }, [
      "https://alfursanauto.ca/a.jpg",
      "https://alfursanauto.ca/b.png",
    ]);
    expect(buildFinalImagesJson(plan, plan.storagePaths)).toEqual(plan.order);
  });

  it("excludes a still-failing image while preserving WP order", () => {
    const plan = planVehiclePhotoMigration({ vin, images_json: [] }, [
      "https://alfursanauto.ca/a.jpg",
      "https://alfursanauto.ca/b.png",
      "https://alfursanauto.ca/c.webp",
    ]);
    // Only the 1st and 3rd uploads succeeded this run.
    const uploaded = [plan.storagePaths[0], plan.storagePaths[2]];
    expect(buildFinalImagesJson(plan, uploaded)).toEqual([
      `vehicles/${vin}/wp-00.jpg`,
      `vehicles/${vin}/wp-02.webp`,
    ]);
  });

  it("merges existing (already-uploaded) paths with newly-uploaded ones on resume, preserving order", () => {
    const plan = planVehiclePhotoMigration(
      { vin, images_json: [`vehicles/${vin}/wp-00.jpg`] },
      [
        "https://alfursanauto.ca/a.jpg",
        "https://alfursanauto.ca/b.png",
        "https://alfursanauto.ca/c.webp",
      ],
    );
    // Only wp-01 uploads successfully this time; wp-02 still fails.
    const uploaded = [`vehicles/${vin}/wp-01.png`];
    expect(buildFinalImagesJson(plan, uploaded)).toEqual([
      `vehicles/${vin}/wp-00.jpg`,
      `vehicles/${vin}/wp-01.png`,
    ]);
  });
});

describe("buildPhotographyStatusPatch", () => {
  it("returns an empty patch when nothing uploaded", () => {
    expect(
      buildPhotographyStatusPatch({ photography_status: "pending" }, 0),
    ).toEqual({});
  });

  it("sets photography_status to done when pending and at least one image uploaded", () => {
    expect(
      buildPhotographyStatusPatch({ photography_status: "pending" }, 3),
    ).toEqual({ photography_status: "done" });
  });

  it("sets photography_status to done when unset (null)", () => {
    expect(
      buildPhotographyStatusPatch({ photography_status: null }, 1),
    ).toEqual({ photography_status: "done" });
  });

  it("does not override an already-done status", () => {
    expect(
      buildPhotographyStatusPatch({ photography_status: "done" }, 2),
    ).toEqual({});
  });

  it("does not override a staff-set 'na' status", () => {
    expect(
      buildPhotographyStatusPatch({ photography_status: "na" }, 2),
    ).toEqual({});
  });
});
