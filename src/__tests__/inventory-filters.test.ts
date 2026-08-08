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
  query: "",
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

describe("matchesFilters — unified search query", () => {
  const car = makeCar({
    vin: "2HKRM3H34FH003085",
    make: "Honda",
    model: "Accord",
  });

  it("matches on an exact VIN", () => {
    expect(
      matchesFilters(car, { ...EMPTY_FILTERS, query: "2HKRM3H34FH003085" }),
    ).toBe(true);
  });

  it("matches on a partial, case-insensitive VIN substring", () => {
    expect(matchesFilters(car, { ...EMPTY_FILTERS, query: "fh003085" })).toBe(
      true,
    );
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(
      matchesFilters(car, { ...EMPTY_FILTERS, query: "  fh003085  " }),
    ).toBe(true);
  });

  it("excludes cars whose VIN/make/model does not contain the search text", () => {
    expect(matchesFilters(car, { ...EMPTY_FILTERS, query: "ZZZZZZZ" })).toBe(
      false,
    );
  });

  it("does not filter on the query when it is empty", () => {
    expect(matchesFilters(car, EMPTY_FILTERS)).toBe(true);
  });

  it("matches on make alone, case-insensitively", () => {
    expect(matchesFilters(car, { ...EMPTY_FILTERS, query: "honda" })).toBe(
      true,
    );
  });

  it("matches on model alone, case-insensitively", () => {
    expect(matchesFilters(car, { ...EMPTY_FILTERS, query: "ACCORD" })).toBe(
      true,
    );
  });

  it("matches on a combined make + model query", () => {
    expect(
      matchesFilters(car, { ...EMPTY_FILTERS, query: "honda accord" }),
    ).toBe(true);
  });

  it("excludes cars whose make does not match the query", () => {
    expect(matchesFilters(car, { ...EMPTY_FILTERS, query: "toyota" })).toBe(
      false,
    );
  });
});
