import { describe, it, expect } from "vitest";
import {
  matchesInventoryFilters,
  EMPTY_INVENTORY_FILTERS,
  type VehicleListItem,
} from "../components/admin/InventoryTable";

function makeVehicle(overrides: Partial<VehicleListItem> = {}): VehicleListItem {
  return {
    vin: "1HGCM82633A004352",
    make: "Honda",
    model: "Accord",
    year: 2022,
    trim: null,
    status: "frontline_ready",
    ownership_status: "available",
    photography_status: "done",
    advertised_price_cargurus: 25_000,
    advertised_price_facebook: null,
    purchase_date: "2026-01-10",
    sale_date: null,
    purchase_price: 20_000,
    sale_price: null,
    expense_total: 0,
    commission_percentage: null,
    ...overrides,
  };
}

describe("matchesInventoryFilters — no filters", () => {
  it("matches any vehicle when all filters are empty", () => {
    expect(matchesInventoryFilters(makeVehicle(), EMPTY_INVENTORY_FILTERS)).toBe(true);
  });
});

describe("matchesInventoryFilters — existing filters", () => {
  it("matches on status", () => {
    const v = makeVehicle({ status: "sold" });
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, status: "sold" })).toBe(true);
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, status: "in_deal" })).toBe(false);
  });

  it("matches on ownership_status", () => {
    const v = makeVehicle({ ownership_status: "en_route" });
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, ownership: "en_route" })).toBe(true);
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, ownership: "available" })).toBe(false);
  });

  it("matches on photography_status", () => {
    const v = makeVehicle({ photography_status: "pending" });
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, photography: "pending" })).toBe(true);
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, photography: "done" })).toBe(false);
  });

  it("respects min/max price range", () => {
    const v = makeVehicle({ advertised_price_cargurus: 25_000 });
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, minPrice: "20000", maxPrice: "30000" })).toBe(true);
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, minPrice: "26000" })).toBe(false);
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, maxPrice: "24000" })).toBe(false);
  });

  it("respects min/max year range", () => {
    const v = makeVehicle({ year: 2022 });
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, minYear: "2020", maxYear: "2024" })).toBe(true);
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, minYear: "2023" })).toBe(false);
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, maxYear: "2021" })).toBe(false);
  });
});

describe("matchesInventoryFilters — purchase date range", () => {
  it("matches a purchase_date within the range", () => {
    const v = makeVehicle({ purchase_date: "2026-03-15" });
    expect(
      matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, purchaseDateFrom: "2026-03-01", purchaseDateTo: "2026-03-31" })
    ).toBe(true);
  });

  it("excludes a purchase_date before the from bound", () => {
    const v = makeVehicle({ purchase_date: "2026-02-28" });
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, purchaseDateFrom: "2026-03-01" })).toBe(false);
  });

  it("excludes a purchase_date after the to bound", () => {
    const v = makeVehicle({ purchase_date: "2026-04-01" });
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, purchaseDateTo: "2026-03-31" })).toBe(false);
  });

  it("excludes a vehicle with no purchase_date when a range filter is set", () => {
    const v = makeVehicle({ purchase_date: null });
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, purchaseDateFrom: "2026-01-01" })).toBe(false);
  });
});

describe("matchesInventoryFilters — sale date range", () => {
  it("matches a sale_date within the range", () => {
    const v = makeVehicle({ sale_date: "2026-06-15" });
    expect(
      matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, saleDateFrom: "2026-06-01", saleDateTo: "2026-06-30" })
    ).toBe(true);
  });

  it("excludes a sale_date outside the range", () => {
    const v = makeVehicle({ sale_date: "2026-07-01" });
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, saleDateTo: "2026-06-30" })).toBe(false);
  });

  it("excludes an unsold vehicle (sale_date null) when a sale-date range filter is set", () => {
    const v = makeVehicle({ sale_date: null });
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, saleDateFrom: "2026-01-01" })).toBe(false);
  });

  it("does not exclude an unsold vehicle when no sale-date filter is set", () => {
    const v = makeVehicle({ sale_date: null });
    expect(matchesInventoryFilters(v, EMPTY_INVENTORY_FILTERS)).toBe(true);
  });
});

describe("matchesInventoryFilters — combined filters", () => {
  it("requires all active filters to match simultaneously", () => {
    const v = makeVehicle({ status: "sold", sale_date: "2026-06-15", year: 2022 });
    expect(
      matchesInventoryFilters(v, {
        ...EMPTY_INVENTORY_FILTERS,
        status: "sold",
        minYear: "2021",
        saleDateFrom: "2026-06-01",
        saleDateTo: "2026-06-30",
      })
    ).toBe(true);

    expect(
      matchesInventoryFilters(v, {
        ...EMPTY_INVENTORY_FILTERS,
        status: "sold",
        minYear: "2023", // fails
        saleDateFrom: "2026-06-01",
      })
    ).toBe(false);
  });
});
