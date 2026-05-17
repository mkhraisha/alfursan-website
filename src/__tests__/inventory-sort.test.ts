import { describe, it, expect } from "vitest";
import { sortCars } from "../components/InventoryFilters";
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

const available1 = makeCar({ id: 1, price: 30000, mileageValue: 50000, date: "2024-01-01", offerType: "For Sale" });
const available2 = makeCar({ id: 2, price: 20000, mileageValue: 30000, date: "2024-03-01", offerType: "For Sale" });
const available3 = makeCar({ id: 3, price: 40000, mileageValue: 70000, date: "2024-02-01", offerType: undefined });
const sold1      = makeCar({ id: 4, price: 15000, mileageValue: 10000, date: "2024-04-01", offerType: "Sold" });
const sold2      = makeCar({ id: 5, price: 50000, mileageValue: 90000, date: "2024-05-01", offerType: "SOLD" });

describe("sortCars — sold cars always appear after available cars", () => {
  it("newest: available cars first, then sold, each group newest-first", () => {
    const result = sortCars([sold1, available1, sold2, available2, available3], "newest");
    const ids = result.map((c) => c.id);
    // available group: 2 (Mar), 3 (Feb), 1 (Jan) → newest first
    // sold group:      5 (May), 4 (Apr) → newest first
    expect(ids).toEqual([2, 3, 1, 5, 4]);
  });

  it("price-asc: available cars first cheapest→most-expensive, then sold cheapest→most-expensive", () => {
    const result = sortCars([sold1, available1, sold2, available2, available3], "price-asc");
    const ids = result.map((c) => c.id);
    // available: 2 (20k), 1 (30k), 3 (40k)
    // sold:      4 (15k), 5 (50k)
    expect(ids).toEqual([2, 1, 3, 4, 5]);
  });

  it("price-desc: available cars first most-expensive→cheapest, then sold most-expensive→cheapest", () => {
    const result = sortCars([sold1, available1, sold2, available2, available3], "price-desc");
    const ids = result.map((c) => c.id);
    // available: 3 (40k), 1 (30k), 2 (20k)
    // sold:      5 (50k), 4 (15k)
    expect(ids).toEqual([3, 1, 2, 5, 4]);
  });

  it("mileage-asc: available cars first lowest→highest mileage, then sold lowest→highest", () => {
    const result = sortCars([sold1, available1, sold2, available2, available3], "mileage-asc");
    const ids = result.map((c) => c.id);
    // available: 2 (30k), 1 (50k), 3 (70k)
    // sold:      4 (10k), 5 (90k)
    expect(ids).toEqual([2, 1, 3, 4, 5]);
  });

  it("mileage-desc: available cars first highest→lowest mileage, then sold highest→lowest", () => {
    const result = sortCars([sold1, available1, sold2, available2, available3], "mileage-desc");
    const ids = result.map((c) => c.id);
    // available: 3 (70k), 1 (50k), 2 (30k)
    // sold:      5 (90k), 4 (10k)
    expect(ids).toEqual([3, 1, 2, 5, 4]);
  });

  it("treats 'SOLD' (any case) as sold", () => {
    const result = sortCars([sold2, available1], "newest");
    expect(result[0].id).toBe(available1.id);
    expect(result[1].id).toBe(sold2.id);
  });

  it("does not move cars with undefined offerType to the sold group", () => {
    const result = sortCars([sold1, available3], "newest");
    expect(result[0].id).toBe(available3.id);
    expect(result[1].id).toBe(sold1.id);
  });

  it("returns an empty array unchanged", () => {
    expect(sortCars([], "newest")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [sold1, available1];
    const copy = [...input];
    sortCars(input, "newest");
    expect(input).toEqual(copy);
  });
});
