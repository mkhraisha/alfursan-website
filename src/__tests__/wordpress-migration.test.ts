import { describe, it, expect } from "vitest";
import {
  normalizeBodyType,
  normalizeDriveType,
  normalizeTransmission,
  normalizeFuelType,
  isSoldOfferType,
  parseLeadingInt,
  stripHtmlToPlainText,
  mapWpCarToVehicleRow,
  summarizeMigrationResults,
  buildReconciliationArtifacts,
  buildFillPatch,
  type ResolvedWpCarFields,
} from "../lib/wordpress-migration";

// ── Enum normalization ─────────────────────────────────────────────────────────

describe("normalizeBodyType", () => {
  it("accepts an already-canonical value", () => {
    expect(normalizeBodyType("sedan")).toBe("sedan");
  });

  it("maps common WP taxonomy aliases", () => {
    expect(normalizeBodyType("Crossover")).toBe("suv");
    expect(normalizeBodyType("Mini-Van")).toBe("van");
    expect(normalizeBodyType("Pick-Up")).toBe("truck");
    expect(normalizeBodyType("Hatch")).toBe("hatchback");
    expect(normalizeBodyType("Estate")).toBe("wagon");
  });

  it("is case/whitespace insensitive", () => {
    expect(normalizeBodyType("  SUV  ")).toBe("suv");
  });

  it("returns undefined for an unrecognised term", () => {
    expect(normalizeBodyType("Roadster")).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(normalizeBodyType(undefined)).toBeUndefined();
  });

  it.each(["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"])(
    "does not resolve to an inherited Object.prototype value for term '%s'",
    (term) => {
      expect(normalizeBodyType(term)).toBeUndefined();
    }
  );
});

describe("normalizeDriveType", () => {
  it("maps display-text aliases", () => {
    expect(normalizeDriveType("All Wheel Drive")).toBe("awd");
    expect(normalizeDriveType("Front Wheel Drive")).toBe("fwd");
    expect(normalizeDriveType("Rear-Wheel Drive")).toBe("rwd");
    expect(normalizeDriveType("4x4")).toBe("4wd");
  });

  it("returns undefined for an unrecognised term", () => {
    expect(normalizeDriveType("2WD")).toBeUndefined();
  });

  it("defaults a combined 'AWD/4WD' term (seen in real WP data) to awd", () => {
    expect(normalizeDriveType("AWD/4WD")).toBe("awd");
  });
});

describe("normalizeTransmission", () => {
  it("maps aliases", () => {
    expect(normalizeTransmission("Auto")).toBe("automatic");
    expect(normalizeTransmission("Standard")).toBe("manual");
    expect(normalizeTransmission("CVT")).toBe("cvt");
  });
});

describe("normalizeFuelType", () => {
  it("maps aliases", () => {
    expect(normalizeFuelType("Petrol")).toBe("gasoline");
    expect(normalizeFuelType("EV")).toBe("electric");
    expect(normalizeFuelType("Plug-in Hybrid")).toBe("hybrid");
    expect(normalizeFuelType("Diesel")).toBe("diesel");
  });
});

describe("isSoldOfferType", () => {
  it("detects sold regardless of casing", () => {
    expect(isSoldOfferType("Sold")).toBe(true);
    expect(isSoldOfferType("SOLD")).toBe(true);
  });

  it("is false for available/other offer types", () => {
    expect(isSoldOfferType("Available")).toBe(false);
    expect(isSoldOfferType(undefined)).toBe(false);
  });
});

describe("parseLeadingInt", () => {
  it("extracts a digit sequence from mixed text", () => {
    expect(parseLeadingInt("V6")).toBe(6);
    expect(parseLeadingInt("4-Cylinder")).toBe(4);
    expect(parseLeadingInt("4 Door")).toBe(4);
  });

  it("returns undefined when no digits are present", () => {
    expect(parseLeadingInt("N/A")).toBeUndefined();
  });
});

describe("stripHtmlToPlainText", () => {
  it("strips tags and decodes entities", () => {
    expect(stripHtmlToPlainText("<p>Clean &amp; tidy &#8212; one owner</p>")).toBe(
      "Clean & tidy — one owner"
    );
  });

  it("collapses repeated whitespace", () => {
    expect(stripHtmlToPlainText("<p>Line one</p>\n\n<p>Line two</p>")).toBe("Line one Line two");
  });
});

// ── mapWpCarToVehicleRow ────────────────────────────────────────────────────────

const FULL_FIELDS: ResolvedWpCarFields = {
  wpId: 123,
  slug: "2020-honda-civic",
  vin: "1hgcm82633a004352",
  make: "Honda",
  model: "Civic",
  year: "2020",
  odometerRaw: "45,000",
  priceObject: { plugin_default: 22500 },
  bodyTypeRaw: "Sedan",
  driveTypeRaw: "Front Wheel Drive",
  transmissionRaw: "Automatic",
  fuelTypeRaw: "Gasoline",
  cylindersRaw: "4 Cylinder",
  doorsRaw: "4 Door",
  colour: "Blue",
  features: ["Backup Camera", "Heated Seats", "Backup Camera"],
  offerTypeRaw: "Available",
  htmlDescription: "<p>Well maintained, single owner.</p>",
};

describe("mapWpCarToVehicleRow — happy path", () => {
  it("maps a fully-populated car with no warnings", () => {
    const result = mapWpCarToVehicleRow(FULL_FIELDS);
    expect(result.skipReason).toBeNull();
    expect(result.warnings).toEqual([]);
    expect(result.vin).toBe("1HGCM82633A004352");
    expect(result.row).toMatchObject({
      vin: "1HGCM82633A004352",
      make: "Honda",
      model: "Civic",
      year: 2020,
      body_type: "sedan",
      drive_type: "fwd",
      transmission: "automatic",
      fuel_type: "gasoline",
      cylinders: 4,
      doors: 4,
      colour: "Blue",
      odometer: 45000,
      advertised_price_cargurus: 22500,
      description: "Well maintained, single owner.",
      status: "frontline_ready",
    });
    expect(result.row?.features).toEqual(["Backup Camera", "Heated Seats"]);
  });

  it("uppercases and trims the VIN", () => {
    const result = mapWpCarToVehicleRow({ ...FULL_FIELDS, vin: " 1hgcm82633a004352 " });
    expect(result.vin).toBe("1HGCM82633A004352");
  });

  it("sets status to sold when the offer type is sold", () => {
    const result = mapWpCarToVehicleRow({ ...FULL_FIELDS, offerTypeRaw: "Sold" });
    expect(result.row?.status).toBe("sold");
  });

  it("never sets images_json, videos_json, or photography_status", () => {
    const result = mapWpCarToVehicleRow(FULL_FIELDS);
    expect(result.row).not.toHaveProperty("images_json");
    expect(result.row).not.toHaveProperty("videos_json");
    expect(result.row).not.toHaveProperty("photography_status");
  });
});

describe("mapWpCarToVehicleRow — blocking issues (row skipped)", () => {
  it("skips a car with a missing VIN", () => {
    const result = mapWpCarToVehicleRow({ ...FULL_FIELDS, vin: undefined });
    expect(result.row).toBeNull();
    expect(result.skipReason).toContain("VIN");
  });

  it("skips a car with an invalid VIN", () => {
    const result = mapWpCarToVehicleRow({ ...FULL_FIELDS, vin: "not-a-vin" });
    expect(result.row).toBeNull();
    expect(result.skipReason).toContain("VIN");
  });

  it("skips a car with a missing make", () => {
    const result = mapWpCarToVehicleRow({ ...FULL_FIELDS, make: undefined });
    expect(result.row).toBeNull();
    expect(result.skipReason).toContain("make");
  });

  it("skips a car with a missing model", () => {
    const result = mapWpCarToVehicleRow({ ...FULL_FIELDS, model: undefined });
    expect(result.row).toBeNull();
    expect(result.skipReason).toContain("model");
  });

  it("skips a car with a missing/invalid year", () => {
    const result = mapWpCarToVehicleRow({ ...FULL_FIELDS, year: undefined });
    expect(result.row).toBeNull();
    expect(result.skipReason).toContain("year");
  });

  it("skips a car with an unrecognised body type", () => {
    const result = mapWpCarToVehicleRow({ ...FULL_FIELDS, bodyTypeRaw: "Roadster" });
    expect(result.row).toBeNull();
    expect(result.skipReason).toContain("body type");
  });

  it("combines multiple blockers into one reason", () => {
    const result = mapWpCarToVehicleRow({ ...FULL_FIELDS, vin: undefined, make: undefined });
    expect(result.skipReason).toContain("VIN");
    expect(result.skipReason).toContain("make");
  });
});

describe("mapWpCarToVehicleRow — soft warnings (row still included)", () => {
  it("warns but keeps the row when drive_type is unmapped", () => {
    const result = mapWpCarToVehicleRow({ ...FULL_FIELDS, driveTypeRaw: "2WD" });
    expect(result.row).not.toBeNull();
    expect(result.row).not.toHaveProperty("drive_type");
    expect(result.warnings.some((w) => w.includes("drive_type"))).toBe(true);
  });

  it("warns but keeps the row when doors is out of range", () => {
    const result = mapWpCarToVehicleRow({ ...FULL_FIELDS, doorsRaw: "1 Door" });
    expect(result.row).not.toBeNull();
    expect(result.row).not.toHaveProperty("doors");
    expect(result.warnings.some((w) => w.includes("doors"))).toBe(true);
  });

  it("omits optional fields entirely when not present on WP, without warning", () => {
    const result = mapWpCarToVehicleRow({ ...FULL_FIELDS, driveTypeRaw: undefined });
    expect(result.row).not.toHaveProperty("drive_type");
    expect(result.warnings).toEqual([]);
  });
});

// ── summarizeMigrationResults ───────────────────────────────────────────────────

describe("summarizeMigrationResults", () => {
  it("counts newVehicles, skipped, matchedExisting, and warnings", () => {
    const results = [
      mapWpCarToVehicleRow(FULL_FIELDS), // new vehicle
      mapWpCarToVehicleRow({ ...FULL_FIELDS, vin: undefined }), // skipped
      mapWpCarToVehicleRow({ ...FULL_FIELDS, vin: "2HGCM82633A004352", driveTypeRaw: "2WD" }), // matches existing, w/ 1 warning
    ];
    const summary = summarizeMigrationResults(results, new Set(["2HGCM82633A004352"]));

    expect(summary.totalFetched).toBe(3);
    expect(summary.newVehicles).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.matchedExisting).toBe(1);
    expect(summary.warningCount).toBe(1);
  });
});

// ── buildReconciliationArtifacts ─────────────────────────────────────────────────

describe("buildReconciliationArtifacts", () => {
  // Regression test for a real bug found in code review: filtering `results`
  // before mapping with `(r, i) => resolved[i]` misaligns the index once
  // anything earlier in the array was filtered out, so wpId/slug in
  // skipped.json/slug-to-vin.json ends up pointing at the wrong WP car.
  it("keeps wpId/slug aligned to the correct car even when an earlier row was skipped", () => {
    const resolved = [
      { wpId: 1, slug: "car-one" },   // will be skipped (missing VIN)
      { wpId: 2, slug: "car-two" },   // valid
      { wpId: 3, slug: "car-three" }, // valid
    ];
    const results = [
      mapWpCarToVehicleRow({ ...FULL_FIELDS, vin: undefined }),
      mapWpCarToVehicleRow({ ...FULL_FIELDS, vin: "2HGCM82633A004352" }),
      mapWpCarToVehicleRow({ ...FULL_FIELDS, vin: "3HGCM82633A004352" }),
    ];

    const { skipped, slugToVin } = buildReconciliationArtifacts(results, resolved);

    expect(skipped).toEqual([{ wpId: 1, slug: "car-one", reason: expect.stringContaining("VIN") }]);
    expect(slugToVin).toEqual({
      "car-two": "2HGCM82633A004352",
      "car-three": "3HGCM82633A004352",
    });
  });

  it("only includes rows with warnings in `warned`, still aligned to the correct car", () => {
    const resolved = [
      { wpId: 1, slug: "car-one" },
      { wpId: 2, slug: "car-two" }, // has an unmapped drive_type — should appear in warned
    ];
    const results = [
      mapWpCarToVehicleRow(FULL_FIELDS),
      mapWpCarToVehicleRow({ ...FULL_FIELDS, vin: "2HGCM82633A004352", driveTypeRaw: "2WD" }),
    ];

    const { warned } = buildReconciliationArtifacts(results, resolved);

    expect(warned).toHaveLength(1);
    expect(warned[0].slug).toBe("car-two");
    expect(warned[0].vin).toBe("2HGCM82633A004352");
  });

  it("omits skipped rows from slugToVin", () => {
    const resolved = [{ wpId: 1, slug: "car-one" }];
    const results = [mapWpCarToVehicleRow({ ...FULL_FIELDS, vin: undefined })];

    const { slugToVin } = buildReconciliationArtifacts(results, resolved);
    expect(slugToVin).toEqual({});
  });
});

// ── buildFillPatch ────────────────────────────────────────────────────────────

describe("buildFillPatch", () => {
  const mappedRow = mapWpCarToVehicleRow(FULL_FIELDS).row!;

  it("fills fields the CSV sheet never carries (cylinders, drive_type, etc.) when they're empty on the existing row", () => {
    const existingRow = {
      vin: mappedRow.vin, make: "Honda", model: "Civic", year: 2020, body_type: "sedan",
      drive_type: null, transmission: null, fuel_type: null, cylinders: null, doors: null,
      colour: null, odometer: null, features: [], description: null,
      advertised_price_cargurus: null, status: null,
    };

    const patch = buildFillPatch(existingRow, mappedRow);

    expect(patch).toMatchObject({
      drive_type: "fwd", transmission: "automatic", fuel_type: "gasoline",
      cylinders: 4, doors: 4, colour: "Blue", odometer: 45000,
      features: ["Backup Camera", "Heated Seats"],
      description: "Well maintained, single owner.",
      advertised_price_cargurus: 22500,
    });
  });

  it("never overwrites a field the existing row already has a value for", () => {
    const existingRow = {
      vin: mappedRow.vin, make: "Honda", model: "Civic", year: 2020, body_type: "sedan",
      colour: "Red", odometer: 99999, drive_type: "awd",
    };

    const patch = buildFillPatch(existingRow, mappedRow);

    expect(patch.colour).toBeUndefined();
    expect(patch.odometer).toBeUndefined();
    expect(patch.drive_type).toBeUndefined();
  });

  it("never includes status, even when the existing row's status is null", () => {
    const existingRow = { status: null };
    const patch = buildFillPatch(existingRow, mappedRow);
    expect(patch).not.toHaveProperty("status");
  });

  it("never includes vin", () => {
    const existingRow = {};
    const patch = buildFillPatch(existingRow, mappedRow);
    expect(patch).not.toHaveProperty("vin");
  });

  it("returns an empty patch when the existing row already has every field populated", () => {
    const existingRow = {
      make: "Honda", model: "Civic", year: 2020, body_type: "sedan",
      drive_type: "awd", transmission: "manual", fuel_type: "diesel",
      cylinders: 6, doors: 2, colour: "Black", odometer: 1,
      features: ["Something"], description: "Already has one", advertised_price_cargurus: 1,
    };

    const patch = buildFillPatch(existingRow, mappedRow);
    expect(patch).toEqual({});
  });

  it("treats an empty features array on the existing row as empty (fills it)", () => {
    const existingRow = { features: [] };
    const patch = buildFillPatch(existingRow, mappedRow);
    expect(patch.features).toEqual(["Backup Camera", "Heated Seats"]);
  });

  it("does not fill a field WordPress itself had nothing for", () => {
    const sparseMappedRow = mapWpCarToVehicleRow({ ...FULL_FIELDS, driveTypeRaw: undefined }).row!;
    const existingRow = { drive_type: null };
    const patch = buildFillPatch(existingRow, sparseMappedRow);
    expect(patch).not.toHaveProperty("drive_type");
  });
});
