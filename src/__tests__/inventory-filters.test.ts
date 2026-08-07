import { describe, it, expect } from "vitest";
import { matchesFilters } from "../components/InventoryFilters";
import type { DisplayVehicle } from "../lib/public-vehicle-view";

function makeCar(overrides: Partial<DisplayVehicle> & { vin: string }): DisplayVehicle {
  return {
    title: `Car ${overrides.vin}`,
    make: null,
    model: null,
    year: null,
    price: null,
    odometer: null,
    colour: null,
    cylinders: null,
    doors: null,
    features: [],
    description: null,
    excerpt: "",
    images: [],
    createdAt: "2024-01-01T00:00:00Z",
    isSold: false,
    ...overrides,
  };
}

const EMPTY_FILTERS = {
  make: "",
  model: "",
  vin: "",
  minPrice: "",
  maxPrice: "",
  maxMileage: "",
  bodyType: "",
  driveType: "",
  fuelType: "",
  transmission: "",
  colour: "",
  sort: "newest",
  page: 1,
};

describe("matchesFilters — search by VIN", () => {
  const car = makeCar({ vin: "2HKRM3H34FH003085" });

  it("matches on an exact VIN", () => {
    expect(
      matchesFilters(car, { ...EMPTY_FILTERS, vin: "2HKRM3H34FH003085" }),
    ).toBe(true);
  });

  it("matches on a partial, case-insensitive VIN substring", () => {
    expect(matchesFilters(car, { ...EMPTY_FILTERS, vin: "fh003085" })).toBe(
      true,
    );
  });

  it("ignores surrounding whitespace in the VIN filter", () => {
    expect(
      matchesFilters(car, { ...EMPTY_FILTERS, vin: "  fh003085  " }),
    ).toBe(true);
  });

  it("excludes cars whose VIN does not contain the search text", () => {
    expect(matchesFilters(car, { ...EMPTY_FILTERS, vin: "ZZZZZZZ" })).toBe(
      false,
    );
  });

  it("does not filter on VIN when the filter is empty", () => {
    expect(matchesFilters(car, EMPTY_FILTERS)).toBe(true);
  });
});
