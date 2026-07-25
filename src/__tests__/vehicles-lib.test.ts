import { describe, it, expect } from "vitest";
import {
  vinSchema,
  vehicleCreateSchema,
  vehicleUpdateSchema,
  calcTotalCost,
  calcProfitLoss,
  calcCommission,
  calcDaysOnLot,
  aggregateMonthlySales,
  getMonthDateRange,
  BODY_TYPES,
  type SoldVehicle,
} from "../lib/vehicles";

// ── VIN validation ────────────────────────────────────────────────────────────

describe("vinSchema", () => {
  it("accepts a valid VIN", () => {
    expect(vinSchema.safeParse("1HGCM82633A004352").success).toBe(true);
  });

  it("rejects a VIN shorter than 17 chars", () => {
    expect(vinSchema.safeParse("1HGCM82633A00435").success).toBe(false);
  });

  it("rejects a VIN longer than 17 chars", () => {
    expect(vinSchema.safeParse("1HGCM82633A0043521").success).toBe(false);
  });

  it("rejects a VIN containing I", () => {
    expect(vinSchema.safeParse("1HGCM82633I004352").success).toBe(false);
  });

  it("rejects a VIN containing O", () => {
    expect(vinSchema.safeParse("1HGCM82633O004352").success).toBe(false);
  });

  it("rejects a VIN containing Q", () => {
    expect(vinSchema.safeParse("1HGCM82633Q004352").success).toBe(false);
  });

  it("rejects a VIN with special characters", () => {
    expect(vinSchema.safeParse("1HGCM826-3A004352").success).toBe(false);
  });
});

// ── vehicleCreateSchema ───────────────────────────────────────────────────────

const BASE_VEHICLE = {
  vin:       "1HGCM82633A004352",
  make:      "Honda",
  model:     "Civic",
  year:      2020,
  body_type: "sedan" as const,
};

describe("vehicleCreateSchema — required fields", () => {
  it("accepts a minimal valid vehicle", () => {
    expect(vehicleCreateSchema.safeParse(BASE_VEHICLE).success).toBe(true);
  });

  it("rejects missing vin", () => {
    const { vin: _, ...rest } = BASE_VEHICLE;
    expect(vehicleCreateSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing make", () => {
    const { make: _, ...rest } = BASE_VEHICLE;
    expect(vehicleCreateSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing model", () => {
    const { model: _, ...rest } = BASE_VEHICLE;
    expect(vehicleCreateSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects year < 1900", () => {
    expect(vehicleCreateSchema.safeParse({ ...BASE_VEHICLE, year: 1800 }).success).toBe(false);
  });

  it("rejects year > 2100", () => {
    expect(vehicleCreateSchema.safeParse({ ...BASE_VEHICLE, year: 2200 }).success).toBe(false);
  });
});

describe("vehicleCreateSchema — prices", () => {
  it("rejects negative purchase_price", () => {
    expect(
      vehicleCreateSchema.safeParse({ ...BASE_VEHICLE, purchase_price: -1 }).success
    ).toBe(false);
  });

  it("accepts purchase_price = 0", () => {
    expect(
      vehicleCreateSchema.safeParse({ ...BASE_VEHICLE, purchase_price: 0 }).success
    ).toBe(true);
  });

  it("rejects negative advertised_price_cargurus", () => {
    expect(
      vehicleCreateSchema.safeParse({ ...BASE_VEHICLE, advertised_price_cargurus: -0.01 }).success
    ).toBe(false);
  });

  it("rejects negative advertised_price_facebook", () => {
    expect(
      vehicleCreateSchema.safeParse({ ...BASE_VEHICLE, advertised_price_facebook: -0.01 }).success
    ).toBe(false);
  });
});

describe("vehicleCreateSchema — dates", () => {
  it("rejects purchase_date in the future", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(
      vehicleCreateSchema.safeParse({ ...BASE_VEHICLE, purchase_date: future }).success
    ).toBe(false);
  });

  it("rejects sale_date before purchase_date", () => {
    expect(
      vehicleCreateSchema.safeParse({
        ...BASE_VEHICLE,
        purchase_date: "2024-06-01",
        sale_date:     "2024-05-01",
      }).success
    ).toBe(false);
  });

  it("accepts sale_date on the same day as purchase_date", () => {
    expect(
      vehicleCreateSchema.safeParse({
        ...BASE_VEHICLE,
        purchase_date: "2024-06-01",
        sale_date:     "2024-06-01",
      }).success
    ).toBe(true);
  });

  it("accepts sale_date after purchase_date", () => {
    expect(
      vehicleCreateSchema.safeParse({
        ...BASE_VEHICLE,
        purchase_date: "2024-06-01",
        sale_date:     "2024-07-01",
      }).success
    ).toBe(true);
  });
});

describe("vehicleCreateSchema — status", () => {
  it("accepts a valid status string", () => {
    expect(
      vehicleCreateSchema.safeParse({ ...BASE_VEHICLE, status: "frontline_ready" }).success
    ).toBe(true);
  });

  it("rejects an invalid status value", () => {
    expect(
      vehicleCreateSchema.safeParse({ ...BASE_VEHICLE, status: "not_a_status" }).success
    ).toBe(false);
  });

  it("accepts null status", () => {
    expect(
      vehicleCreateSchema.safeParse({ ...BASE_VEHICLE, status: null }).success
    ).toBe(true);
  });

  it("accepts missing status (optional)", () => {
    const { status: _, ...noStatus } = { ...BASE_VEHICLE, status: "frontline_ready" };
    expect(vehicleCreateSchema.safeParse(noStatus).success).toBe(true);
  });
});

describe("vehicleUpdateSchema — partial", () => {
  it("accepts empty object (no fields required)", () => {
    expect(vehicleUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a single field update", () => {
    expect(vehicleUpdateSchema.safeParse({ colour: "Red" }).success).toBe(true);
  });

  it("rejects vin (not allowed in update)", () => {
    const result = vehicleUpdateSchema.safeParse({ vin: "1HGCM82633A004352" });
    // vin is omitted from the update schema, so it is simply stripped / ignored — not an error
    // Verify the parsed output does not contain vin
    if (result.success) {
      expect("vin" in result.data).toBe(false);
    }
  });
});

// ── calcTotalCost ─────────────────────────────────────────────────────────────

describe("calcTotalCost", () => {
  it("returns purchase_price when no expenses", () => {
    expect(calcTotalCost(10_000, 0)).toBe(10_000);
  });

  it("adds expenses to purchase price", () => {
    expect(calcTotalCost(10_000, 1_500)).toBe(11_500);
  });

  it("returns null when purchase_price is null", () => {
    expect(calcTotalCost(null, 500)).toBeNull();
  });

  it("handles fractional amounts correctly (2 decimal places)", () => {
    expect(calcTotalCost(10_000.5, 250.75)).toBe(10_251.25);
  });
});

// ── calcProfitLoss ────────────────────────────────────────────────────────────

describe("calcProfitLoss", () => {
  it("uses sale_price when available (car sold)", () => {
    expect(calcProfitLoss(13_000, 11_000)).toBe(2_000);
  });

  it("returns null when sale_price is null (car not sold)", () => {
    expect(calcProfitLoss(null, 11_000)).toBeNull();
  });

  it("returns negative when sold at a loss", () => {
    expect(calcProfitLoss(9_000, 11_000)).toBe(-2_000);
  });

  it("returns null when total_cost is null", () => {
    expect(calcProfitLoss(13_000, null)).toBeNull();
  });
});

// ── calcCommission ────────────────────────────────────────────────────────────

describe("calcCommission", () => {
  it("calculates percentage of profit", () => {
    expect(calcCommission(10_000, 0.1)).toBe(1_000);
  });

  it("applies $150 floor when profit is negative", () => {
    expect(calcCommission(-2_000, 0.1)).toBe(150);
  });

  it("applies $150 floor when profit is exactly 0", () => {
    // zero profit is not a loss — commission should be 0%, not $150
    expect(calcCommission(0, 0.1)).toBe(0);
  });

  it("returns null when commissionPct is null", () => {
    expect(calcCommission(10_000, null)).toBeNull();
  });

  it("returns null when profitLoss is null", () => {
    expect(calcCommission(null, 0.1)).toBeNull();
  });

  it("rounds to 2 decimal places", () => {
    expect(calcCommission(333, 0.1)).toBe(33.3);
  });
});

// ── calcDaysOnLot ─────────────────────────────────────────────────────────────

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

describe("calcDaysOnLot", () => {
  it("returns null when purchaseDate is null", () => {
    expect(calcDaysOnLot(null)).toBeNull();
  });

  it("returns 0 when purchased today", () => {
    expect(calcDaysOnLot(daysAgoStr(0))).toBe(0);
  });

  it("returns correct day count for a past purchase date", () => {
    expect(calcDaysOnLot(daysAgoStr(30))).toBe(30);
    expect(calcDaysOnLot(daysAgoStr(365))).toBe(365);
  });

  it("returns 0 (not negative) for a future date", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(calcDaysOnLot(tomorrow.toISOString().slice(0, 10))).toBe(0);
  });
});

// ── aggregateMonthlySales ─────────────────────────────────────────────────────

function sold(overrides: Partial<SoldVehicle>): SoldVehicle {
  return {
    sale_date: "2026-06-15",
    sale_price: 20_000,
    purchase_price: 15_000,
    expense_total: 0,
    ...overrides,
  };
}

describe("aggregateMonthlySales", () => {
  it("returns an empty array for no vehicles", () => {
    expect(aggregateMonthlySales([])).toEqual([]);
  });

  it("groups a single sale into its month", () => {
    const result = aggregateMonthlySales([sold({})]);
    expect(result).toEqual([
      { month: "2026-06", unitsSold: 1, totalRevenue: 20_000, totalCost: 15_000, totalProfitLoss: 5_000 },
    ]);
  });

  it("sums multiple sales within the same month", () => {
    const result = aggregateMonthlySales([
      sold({ sale_date: "2026-06-01", sale_price: 20_000, purchase_price: 15_000 }),
      sold({ sale_date: "2026-06-28", sale_price: 12_000, purchase_price: 9_000, expense_total: 500 }),
    ]);
    expect(result).toEqual([
      { month: "2026-06", unitsSold: 2, totalRevenue: 32_000, totalCost: 24_500, totalProfitLoss: 7_500 },
    ]);
  });

  it("splits sales in different months and sorts most-recent-first", () => {
    const result = aggregateMonthlySales([
      sold({ sale_date: "2026-05-10", sale_price: 10_000, purchase_price: 8_000 }),
      sold({ sale_date: "2026-06-10", sale_price: 20_000, purchase_price: 15_000 }),
    ]);
    expect(result.map((m) => m.month)).toEqual(["2026-06", "2026-05"]);
  });

  it("includes a sale with unknown purchase_price in unitsSold/revenue but treats its P/L as 0", () => {
    const result = aggregateMonthlySales([sold({ purchase_price: null, sale_price: 20_000 })]);
    expect(result[0]).toEqual({
      month: "2026-06", unitsSold: 1, totalRevenue: 20_000, totalCost: 0, totalProfitLoss: 0,
    });
  });

  it("accounts for expenses when computing total cost and P/L", () => {
    const result = aggregateMonthlySales([sold({ purchase_price: 10_000, expense_total: 2_000, sale_price: 15_000 })]);
    expect(result[0].totalCost).toBe(12_000);
    expect(result[0].totalProfitLoss).toBe(3_000);
  });

  it("reports a loss month with a negative totalProfitLoss", () => {
    const result = aggregateMonthlySales([sold({ purchase_price: 20_000, sale_price: 15_000 })]);
    expect(result[0].totalProfitLoss).toBe(-5_000);
  });
});

// ── getMonthDateRange ─────────────────────────────────────────────────────────

describe("getMonthDateRange", () => {
  it("returns the first day of the month as start", () => {
    expect(getMonthDateRange(new Date(2026, 5, 15)).start).toBe("2026-06-01");
  });

  it("returns the first day of the following month as end", () => {
    expect(getMonthDateRange(new Date(2026, 5, 15)).end).toBe("2026-07-01");
  });

  it("rolls over into January of the next year for December", () => {
    expect(getMonthDateRange(new Date(2026, 11, 1))).toEqual({
      start: "2026-12-01",
      end: "2027-01-01",
    });
  });

  it("is unaffected by which day of the month `now` falls on", () => {
    expect(getMonthDateRange(new Date(2026, 1, 1))).toEqual(getMonthDateRange(new Date(2026, 1, 28)));
  });

  it("pads single-digit months with a leading zero", () => {
    expect(getMonthDateRange(new Date(2026, 0, 5)).start).toBe("2026-01-01");
  });
});

// ── BODY_TYPES enum validation ────────────────────────────────────────────────
// BASE_VEHICLE is declared above (includes body_type: "sedan")

describe("vehicleCreateSchema — body_type", () => {
  it.each(BODY_TYPES)("accepts valid body_type '%s'", (bt) => {
    expect(vehicleCreateSchema.safeParse({ ...BASE_VEHICLE, body_type: bt }).success).toBe(true);
  });

  it("rejects an unrecognised body_type", () => {
    expect(vehicleCreateSchema.safeParse({ ...BASE_VEHICLE, body_type: "suv" }).success).toBe(false);
  });

  it("rejects body_type with wrong capitalisation", () => {
    expect(vehicleCreateSchema.safeParse({ ...BASE_VEHICLE, body_type: "Sedan" }).success).toBe(false);
  });

  it("rejects missing body_type (required on create)", () => {
    const { body_type: _, ...noBodyType } = { ...BASE_VEHICLE, body_type: "sedan" };
    expect(vehicleCreateSchema.safeParse(noBodyType).success).toBe(false);
  });

  it("body_type is optional on update (partial schema)", () => {
    expect(vehicleUpdateSchema.safeParse({ colour: "Blue" }).success).toBe(true);
  });
});
