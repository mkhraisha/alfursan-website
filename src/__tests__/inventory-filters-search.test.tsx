/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import InventoryFilters from "../components/InventoryFilters";
import type { DisplayVehicle } from "../lib/public-vehicle-view";

// Component-level coverage for the unified search redesign (PublicSearchBar +
// the Filters popover). Pure-function coverage for the underlying matching/
// URL logic lives in inventory-filters.test.ts; sold-badge markup coverage
// lives in inventory-filters-rendering.test.tsx. This file exercises the
// actual rendered UI a shopper interacts with.

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

const CARS: DisplayVehicle[] = [
  makeCar({
    vin: "1HGCM82633A004352",
    title: "2020 Honda Accord",
    make: "Honda",
    model: "Accord",
    year: 2020,
    price: 22000,
    odometer: 40000,
    bodyType: "Sedan",
  }),
  makeCar({
    vin: "2T1BURHE0JC123456",
    title: "2019 Toyota Corolla",
    make: "Toyota",
    model: "Corolla",
    year: 2019,
    price: 15000,
    odometer: 60000,
    bodyType: "Sedan",
  }),
  makeCar({
    vin: "3FADP4EJ7DM111111",
    title: "2018 Ford Fiesta",
    make: "Ford",
    model: "Fiesta",
    year: 2018,
    price: 9000,
    odometer: 90000,
    bodyType: "Hatchback",
  }),
];

beforeEach(() => {
  // Each InventoryFilters instance reads/writes URLSearchParams on mount and
  // on every filter change — reset between tests so state doesn't leak.
  window.history.replaceState({}, "", "/search/");
});

describe("InventoryFilters — unified search UI", () => {
  it("shows every car and the total results count with no filters applied", () => {
    render(<InventoryFilters cars={CARS} />);
    expect(screen.getByText("3 Results")).toBeInTheDocument();
    expect(screen.getByText("2020 Honda Accord")).toBeInTheDocument();
    expect(screen.getByText("2019 Toyota Corolla")).toBeInTheDocument();
    expect(screen.getByText("2018 Ford Fiesta")).toBeInTheDocument();
  });

  it("filters results as the user types in the unified search box", () => {
    render(<InventoryFilters cars={CARS} />);
    const search = screen.getByPlaceholderText("Search by make, model, or VIN");

    fireEvent.change(search, { target: { value: "honda" } });

    expect(screen.getByText("1 Results")).toBeInTheDocument();
    expect(screen.getByText("2020 Honda Accord")).toBeInTheDocument();
    expect(screen.queryByText("2019 Toyota Corolla")).not.toBeInTheDocument();
  });

  it("matches on VIN as well as make/model", () => {
    render(<InventoryFilters cars={CARS} />);
    const search = screen.getByPlaceholderText("Search by make, model, or VIN");

    fireEvent.change(search, { target: { value: "2T1BURHE0JC123456" } });

    expect(screen.getByText("1 Results")).toBeInTheDocument();
    expect(screen.getByText("2019 Toyota Corolla")).toBeInTheDocument();
  });

  it("keeps the query in the URL so the view is shareable/bookmarkable", () => {
    render(<InventoryFilters cars={CARS} />);
    fireEvent.change(screen.getByPlaceholderText("Search by make, model, or VIN"), {
      target: { value: "honda" },
    });

    expect(new URLSearchParams(window.location.search).get("query")).toBe("honda");
  });

  it("opens the Filters popover, applies a body-type filter, and shows the active-count badge", () => {
    render(<InventoryFilters cars={CARS} />);

    expect(screen.queryByText("1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Filters/i }));

    const bodyTypeSelect = screen.getByLabelText("Body Type");
    fireEvent.change(bodyTypeSelect, { target: { value: "hatchback" } });

    expect(screen.getByText("1 Results")).toBeInTheDocument();
    expect(screen.getByText("2018 Ford Fiesta")).toBeInTheDocument();
    // The Filters button itself now carries a "1" badge for the one active filter.
    const filtersButton = screen.getByRole("button", { name: /^Filters/i });
    expect(within(filtersButton).getByText("1")).toBeInTheDocument();
  });

  it("Clear all resets both the query and the advanced filters", () => {
    render(<InventoryFilters cars={CARS} />);

    fireEvent.change(screen.getByPlaceholderText("Search by make, model, or VIN"), {
      target: { value: "honda" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Filters/i }));
    fireEvent.change(screen.getByLabelText("Body Type"), { target: { value: "sedan" } });

    expect(screen.getByText("1 Results")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Clear all/i }));

    expect(screen.getByText("3 Results")).toBeInTheDocument();
    expect(
      (screen.getByPlaceholderText("Search by make, model, or VIN") as HTMLInputElement).value,
    ).toBe("");
  });

  it("sorts results when a sort option is chosen", () => {
    render(<InventoryFilters cars={CARS} />);

    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "price-asc" } });

    const titles = screen.getAllByRole("heading", { level: 2 }).map((el) => el.textContent);
    expect(titles).toEqual(["2018 Ford Fiesta", "2019 Toyota Corolla", "2020 Honda Accord"]);
  });
});
