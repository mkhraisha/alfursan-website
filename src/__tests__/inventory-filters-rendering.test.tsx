import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import InventoryFilters from "../components/InventoryFilters";
import type { DisplayVehicle } from "../lib/public-vehicle-view";

// Renders the real component (used by both /search/ and /sold/) to a markup
// string so a regression in the Sold-badge markup fails a test instead of
// only being caught by eye. See popular-makes.test.tsx for why this exists.

function makeCar(overrides: Partial<DisplayVehicle> & { vin: string }): DisplayVehicle {
  return {
    title: `Car ${overrides.vin}`,
    make: "Honda",
    model: "Accord",
    year: 2021,
    price: 25000,
    odometer: 40000,
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

describe("InventoryFilters rendering", () => {
  it("renders a Sold badge for a sold car", () => {
    const markup = renderToStaticMarkup(
      <InventoryFilters cars={[makeCar({ vin: "SOLD1", isSold: true })]} />,
    );
    expect(markup).toContain("sold-badge");
    expect(markup).toContain("Sold");
  });

  it("renders no Sold badge for an available car", () => {
    const markup = renderToStaticMarkup(
      <InventoryFilters cars={[makeCar({ vin: "AVAIL1", isSold: false })]} />,
    );
    expect(markup).not.toContain("sold-badge");
  });
});
