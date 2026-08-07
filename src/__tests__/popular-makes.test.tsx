import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PopularMakes from "../components/PopularMakes";
import type { DisplayVehicle } from "../lib/public-vehicle-view";

// Renders the real component to a markup string (no jsdom needed) so a
// regression like "the isSold flag is threaded through but no page ever
// renders a badge for it" fails here instead of only being caught by eye.
// This bit us once already: PopularMakes.tsx and listing/[vin].astro's
// Related Listings section both already had `isSold` available on their
// cars but never rendered a badge for it until a follow-up fix.

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

describe("PopularMakes", () => {
  it("renders a Sold badge for a sold car in the carousel", () => {
    const markup = renderToStaticMarkup(
      <PopularMakes
        makes={[{ make: "Honda", count: 1, cars: [makeCar({ vin: "SOLD1", isSold: true })] }]}
      />,
    );
    expect(markup).toContain("pm-sold-badge");
    expect(markup).toContain("Sold");
  });

  it("renders no Sold badge for an available car", () => {
    const markup = renderToStaticMarkup(
      <PopularMakes
        makes={[{ make: "Honda", count: 1, cars: [makeCar({ vin: "AVAIL1", isSold: false })] }]}
      />,
    );
    expect(markup).not.toContain("pm-sold-badge");
  });
});
