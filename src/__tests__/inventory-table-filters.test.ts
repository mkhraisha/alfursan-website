import { describe, it, expect } from "vitest";
import {
  matchesInventoryFilters,
  EMPTY_INVENTORY_FILTERS,
  STATUS_NOT_SOLD,
  compareInventoryRows,
  DEFAULT_SORT_KEY,
  DEFAULT_SORT_DIR,
  type VehicleListItem,
  type SortableInventoryRow,
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

describe("matchesInventoryFilters — STATUS_NOT_SOLD (default inventory view)", () => {
  it("excludes sold vehicles", () => {
    const v = makeVehicle({ status: "sold" });
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, status: STATUS_NOT_SOLD })).toBe(false);
  });

  it("includes non-sold vehicles regardless of their status", () => {
    const v = makeVehicle({ status: "in_deal" });
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, status: STATUS_NOT_SOLD })).toBe(true);
  });

  it("includes vehicles with no status set", () => {
    const v = makeVehicle({ status: null });
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, status: STATUS_NOT_SOLD })).toBe(true);
  });
});

describe("default inventory sort", () => {
  it("defaults to purchase_date, oldest first", () => {
    expect(DEFAULT_SORT_KEY).toBe("purchase_date");
    expect(DEFAULT_SORT_DIR).toBe("asc");
  });
});

describe("compareInventoryRows", () => {
  function makeRow(overrides: Partial<SortableInventoryRow> = {}): SortableInventoryRow {
    return {
      vin: "1HGCM82633A004352", make: "Honda", year: 2022,
      advertised_price_cargurus: 25_000, totalCost: 20_000, profitLoss: 5_000,
      purchase_date: "2026-01-10",
      ...overrides,
    };
  }

  it("sorts by purchase_date descending (most recent first) when toggled", () => {
    const older = makeRow({ vin: "A", purchase_date: "2026-01-01" });
    const newer = makeRow({ vin: "B", purchase_date: "2026-06-01" });
    const sorted = [older, newer].sort((a, b) => compareInventoryRows(a, b, "purchase_date", "desc"));
    expect(sorted.map((r) => r.vin)).toEqual(["B", "A"]);
  });

  it("sorts by purchase_date ascending (oldest first) — the default", () => {
    const older = makeRow({ vin: "A", purchase_date: "2026-01-01" });
    const newer = makeRow({ vin: "B", purchase_date: "2026-06-01" });
    const sorted = [newer, older].sort((a, b) => compareInventoryRows(a, b, "purchase_date", "asc"));
    expect(sorted.map((r) => r.vin)).toEqual(["A", "B"]);
  });

  it("sorts a vehicle with no purchase_date to the end when ascending", () => {
    const withDate = makeRow({ vin: "A", purchase_date: "2026-01-01" });
    const noDate   = makeRow({ vin: "B", purchase_date: null });
    const sorted = [noDate, withDate].sort((a, b) => compareInventoryRows(a, b, "purchase_date", "asc"));
    expect(sorted.map((r) => r.vin)).toEqual(["A", "B"]);
  });

  it("still sorts correctly by the other existing keys (e.g. year)", () => {
    const older = makeRow({ vin: "A", year: 2018 });
    const newer = makeRow({ vin: "B", year: 2022 });
    const sorted = [newer, older].sort((a, b) => compareInventoryRows(a, b, "year", "asc"));
    expect(sorted.map((r) => r.vin)).toEqual(["A", "B"]);
  });
});

describe("matchesInventoryFilters — search by VIN", () => {
  it("matches on an exact VIN", () => {
    const v = makeVehicle({ vin: "1HGCM82633A004352" });
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, vin: "1HGCM82633A004352" })).toBe(true);
  });

  it("matches on a partial, case-insensitive VIN substring", () => {
    const v = makeVehicle({ vin: "1HGCM82633A004352" });
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, vin: "a004352" })).toBe(true);
  });

  it("ignores surrounding whitespace in the VIN filter", () => {
    const v = makeVehicle({ vin: "1HGCM82633A004352" });
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, vin: "  a004352  " })).toBe(true);
  });

  it("excludes vehicles whose VIN does not contain the search text", () => {
    const v = makeVehicle({ vin: "1HGCM82633A004352" });
    expect(matchesInventoryFilters(v, { ...EMPTY_INVENTORY_FILTERS, vin: "ZZZZZZZ" })).toBe(false);
  });

  it("does not filter on VIN when the filter is empty", () => {
    expect(matchesInventoryFilters(makeVehicle(), EMPTY_INVENTORY_FILTERS)).toBe(true);
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
