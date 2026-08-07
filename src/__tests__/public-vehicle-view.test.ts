import { describe, it, expect } from "vitest";
import {
  buildVehicleTitle,
  buildVehicleExcerpt,
  capitalizeFirst,
  driveTypeLabel,
  bodyTypeLabel,
  transmissionLabel,
  fuelTypeLabel,
  resolveVehicleImageUrls,
  formatVehiclePrice,
  toDisplayVehicle,
  isVehicleSold,
  PUBLIC_BODY_TYPES,
  type PublicVehicle,
} from "../lib/public-vehicle-view";
import { BODY_TYPES } from "../lib/vehicles";

describe("formatVehiclePrice", () => {
  it("formats a number as CAD currency with no decimals", () => {
    expect(formatVehiclePrice(28000)).toBe("$28,000");
  });

  it("returns 'Call for price' for non-numeric input", () => {
    expect(formatVehiclePrice(undefined)).toBe("Call for price");
    expect(formatVehiclePrice(null)).toBe("Call for price");
  });
});

describe("buildVehicleTitle", () => {
  it("joins year/make/model/trim in order", () => {
    expect(
      buildVehicleTitle({ year: 2020, make: "Ford", model: "Explorer", trim: "XLT" }),
    ).toBe("2020 Ford Explorer XLT");
  });

  it("omits trim when absent", () => {
    expect(
      buildVehicleTitle({ year: 2020, make: "Ford", model: "Explorer", trim: null }),
    ).toBe("2020 Ford Explorer");
  });

  it("omits missing fields entirely rather than leaving gaps", () => {
    expect(
      buildVehicleTitle({ year: null, make: "Ford", model: null, trim: null }),
    ).toBe("Ford");
  });
});

describe("buildVehicleExcerpt", () => {
  it("returns an empty string for no description", () => {
    expect(buildVehicleExcerpt(null)).toBe("");
    expect(buildVehicleExcerpt(undefined)).toBe("");
  });

  it("collapses whitespace/newlines into single spaces", () => {
    expect(buildVehicleExcerpt("Line one.\n\nLine two.")).toBe(
      "Line one. Line two.",
    );
  });

  it("passes short text through unchanged", () => {
    expect(buildVehicleExcerpt("Well maintained, single owner.")).toBe(
      "Well maintained, single owner.",
    );
  });

  it("truncates long text with an ellipsis at the given length", () => {
    const long = "a".repeat(300);
    const excerpt = buildVehicleExcerpt(long, 220);
    expect(excerpt.length).toBe(221); // 220 chars + ellipsis
    expect(excerpt.endsWith("…")).toBe(true);
  });
});

describe("capitalizeFirst", () => {
  it("capitalizes only the first letter", () => {
    expect(capitalizeFirst("automatic")).toBe("Automatic");
    expect(capitalizeFirst("suv")).toBe("Suv");
  });
});

describe("driveTypeLabel", () => {
  it("uppercases drive type abbreviations", () => {
    expect(driveTypeLabel("awd")).toBe("AWD");
    expect(driveTypeLabel("4wd")).toBe("4WD");
  });

  it("returns undefined for null/undefined", () => {
    expect(driveTypeLabel(null)).toBeUndefined();
    expect(driveTypeLabel(undefined)).toBeUndefined();
  });
});

describe("bodyTypeLabel / transmissionLabel / fuelTypeLabel", () => {
  it("capitalize the first letter", () => {
    expect(bodyTypeLabel("hatchback")).toBe("Hatchback");
    expect(transmissionLabel("cvt")).toBe("Cvt");
    expect(fuelTypeLabel("gasoline")).toBe("Gasoline");
  });

  it("return undefined for null/undefined", () => {
    expect(bodyTypeLabel(null)).toBeUndefined();
    expect(transmissionLabel(undefined)).toBeUndefined();
    expect(fuelTypeLabel(null)).toBeUndefined();
  });
});

describe("resolveVehicleImageUrls", () => {
  it("builds a public storage URL for each path, preserving order", () => {
    const urls = resolveVehicleImageUrls("https://project.supabase.co", [
      "vehicles/1HGCM82633A123456/wp-00.jpg",
      "vehicles/1HGCM82633A123456/wp-01.jpg",
    ]);
    expect(urls).toEqual([
      "https://project.supabase.co/storage/v1/object/public/vehicle-images/vehicles/1HGCM82633A123456/wp-00.jpg",
      "https://project.supabase.co/storage/v1/object/public/vehicle-images/vehicles/1HGCM82633A123456/wp-01.jpg",
    ]);
  });

  it("returns an empty array for null/undefined/empty input", () => {
    expect(resolveVehicleImageUrls("https://project.supabase.co", null)).toEqual([]);
    expect(resolveVehicleImageUrls("https://project.supabase.co", undefined)).toEqual([]);
    expect(resolveVehicleImageUrls("https://project.supabase.co", [])).toEqual([]);
  });
});

const FULL_VEHICLE: PublicVehicle = {
  vin: "1HGCM82633A123456",
  make: "Ford",
  model: "Explorer",
  trim: "XLT",
  series: null,
  year: 2020,
  colour: "White",
  odometer: 45000,
  body_type: "suv",
  drive_type: "awd",
  transmission: "automatic",
  fuel_type: "gasoline",
  cylinders: 6,
  doors: 4,
  features: ["Backup Camera", "Heated Seats"],
  description: "Well maintained.\n\nSingle owner.",
  advertised_price_cargurus: 28000,
  images_json: ["vehicles/1HGCM82633A123456/wp-00.jpg", "vehicles/1HGCM82633A123456/wp-01.jpg"],
  videos_json: [],
  carfax_link: null,
  created_at: "2026-07-01T00:00:00Z",
  isSold: false,
};

describe("toDisplayVehicle", () => {
  it("maps every field to its display equivalent", () => {
    const display = toDisplayVehicle(FULL_VEHICLE, "https://project.supabase.co");

    expect(display).toEqual({
      vin: "1HGCM82633A123456",
      title: "2020 Ford Explorer XLT",
      make: "Ford",
      model: "Explorer",
      year: 2020,
      price: 28000,
      odometer: 45000,
      bodyType: "Suv",
      driveType: "AWD",
      transmission: "Automatic",
      fuelType: "Gasoline",
      colour: "White",
      cylinders: 6,
      doors: 4,
      features: ["Backup Camera", "Heated Seats"],
      description: "Well maintained.\n\nSingle owner.",
      excerpt: "Well maintained. Single owner.",
      images: [
        "https://project.supabase.co/storage/v1/object/public/vehicle-images/vehicles/1HGCM82633A123456/wp-00.jpg",
        "https://project.supabase.co/storage/v1/object/public/vehicle-images/vehicles/1HGCM82633A123456/wp-01.jpg",
      ],
      createdAt: "2026-07-01T00:00:00Z",
      isSold: false,
    });
  });

  it("carries isSold through unchanged when true", () => {
    const display = toDisplayVehicle(
      { ...FULL_VEHICLE, isSold: true },
      "https://project.supabase.co",
    );
    expect(display.isSold).toBe(true);
  });

  it("handles missing optional spec fields gracefully", () => {
    const sparse: PublicVehicle = {
      ...FULL_VEHICLE,
      trim: null,
      body_type: null,
      drive_type: null,
      transmission: null,
      fuel_type: null,
      features: [],
      images_json: [],
      description: null,
    };
    const display = toDisplayVehicle(sparse, "https://project.supabase.co");

    expect(display.title).toBe("2020 Ford Explorer");
    expect(display.bodyType).toBeUndefined();
    expect(display.driveType).toBeUndefined();
    expect(display.transmission).toBeUndefined();
    expect(display.fuelType).toBeUndefined();
    expect(display.features).toEqual([]);
    expect(display.images).toEqual([]);
    expect(display.excerpt).toBe("");
  });
});

describe("isVehicleSold", () => {
  it("is true only for the exact 'sold' status", () => {
    expect(isVehicleSold("sold")).toBe(true);
  });

  it("is false for other statuses, null, and undefined", () => {
    expect(isVehicleSold("frontline_ready")).toBe(false);
    expect(isVehicleSold("in_deal")).toBe(false);
    expect(isVehicleSold(null)).toBe(false);
    expect(isVehicleSold(undefined)).toBe(false);
  });
});

describe("PUBLIC_BODY_TYPES", () => {
  it("stays in sync with BODY_TYPES in src/lib/vehicles.ts", () => {
    // Duplicated (not imported) so client-hydrated components never pull
    // vehicles.ts's zod dependency into the browser bundle — see the comment
    // on PUBLIC_BODY_TYPES. This test is the only thing keeping them in sync.
    expect(PUBLIC_BODY_TYPES).toEqual(BODY_TYPES);
  });
});
