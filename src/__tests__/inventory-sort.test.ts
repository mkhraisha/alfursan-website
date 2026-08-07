import { describe, it, expect } from "vitest";
import { sortCars } from "../components/InventoryFilters";
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

// raw `status` is never exposed to the public site (WordPress migration
// Part 3) — only the derived `isSold` flag is, and it doesn't affect sort
// order — sortCars just sorts by the given criterion, nothing sorts to the
// bottom.
const carA = makeCar({ vin: "A", price: 30000, odometer: 50000, createdAt: "2024-01-01T00:00:00Z" });
const carB = makeCar({ vin: "B", price: 20000, odometer: 30000, createdAt: "2024-03-01T00:00:00Z" });
const carC = makeCar({ vin: "C", price: 40000, odometer: 70000, createdAt: "2024-02-01T00:00:00Z" });
const carD = makeCar({ vin: "D", price: 15000, odometer: 10000, createdAt: "2024-04-01T00:00:00Z" });
const carE = makeCar({ vin: "E", price: 50000, odometer: 90000, createdAt: "2024-05-01T00:00:00Z" });

describe("sortCars", () => {
  it("newest: sorts by createdAt descending", () => {
    const result = sortCars([carA, carB, carC, carD, carE], "newest");
    expect(result.map((c) => c.vin)).toEqual(["E", "D", "B", "C", "A"]);
  });

  it("price-asc: sorts by price ascending", () => {
    const result = sortCars([carA, carB, carC, carD, carE], "price-asc");
    expect(result.map((c) => c.vin)).toEqual(["D", "B", "A", "C", "E"]);
  });

  it("price-desc: sorts by price descending", () => {
    const result = sortCars([carA, carB, carC, carD, carE], "price-desc");
    expect(result.map((c) => c.vin)).toEqual(["E", "C", "A", "B", "D"]);
  });

  it("mileage-asc: sorts by odometer ascending", () => {
    const result = sortCars([carA, carB, carC, carD, carE], "mileage-asc");
    expect(result.map((c) => c.vin)).toEqual(["D", "B", "A", "C", "E"]);
  });

  it("mileage-desc: sorts by odometer descending", () => {
    const result = sortCars([carA, carB, carC, carD, carE], "mileage-desc");
    expect(result.map((c) => c.vin)).toEqual(["E", "C", "A", "B", "D"]);
  });

  it("cars with a missing price sort last, both ascending and descending", () => {
    const noPrice = makeCar({ vin: "F", price: null });
    const asc = sortCars([carA, noPrice], "price-asc");
    expect(asc.map((c) => c.vin)).toEqual(["A", "F"]);
    const desc = sortCars([carA, noPrice], "price-desc");
    expect(desc.map((c) => c.vin)).toEqual(["A", "F"]);
  });

  it("returns an empty array unchanged", () => {
    expect(sortCars([], "newest")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [carD, carA];
    const copy = [...input];
    sortCars(input, "newest");
    expect(input).toEqual(copy);
  });
});
