import { describe, it, expect } from "vitest";
import { matchesFilters } from "../components/InventoryFilters";
import type { CarSummary } from "../lib/wordpress";

function makeCar(overrides: Partial<CarSummary> & { id: number }): CarSummary {
  return {
    slug: `car-${overrides.id}`,
    title: `Car ${overrides.id}`,
    htmlDescription: "",
    excerpt: "",
    images: [],
    features: [],
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
  condition: "",
  vehicleType: "",
  driveType: "",
  fuelType: "",
  transmission: "",
  color: "",
  sort: "newest",
  page: 1,
};

describe("matchesFilters — search by VIN", () => {
  const car = makeCar({ id: 1, vin: "2HKRM3H34FH003085" });

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

  it("excludes cars with no VIN when a VIN filter is set", () => {
    const noVin = makeCar({ id: 2 });
    expect(matchesFilters(noVin, { ...EMPTY_FILTERS, vin: "abc" })).toBe(
      false,
    );
  });

  it("does not filter on VIN when the filter is empty", () => {
    expect(matchesFilters(car, EMPTY_FILTERS)).toBe(true);
  });
});
