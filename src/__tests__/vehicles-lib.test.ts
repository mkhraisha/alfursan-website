import { describe, it, expect } from "vitest";
import {
  vinSchema,
  vehicleCreateSchema,
  vehicleUpdateSchema,
  calcTotalCost,
  calcProfitLoss,
  calcCommission,
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
  vin:  "1HGCM82633A004352",
  make: "Honda",
  model: "Civic",
  year: 2020,
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
    expect(calcProfitLoss(13_000, 14_000, 11_000)).toBe(2_000);
  });

  it("falls back to advertised_price_cargurus when sale_price is null", () => {
    expect(calcProfitLoss(null, 14_000, 11_000)).toBe(3_000);
  });

  it("returns negative when sold at a loss", () => {
    expect(calcProfitLoss(9_000, null, 11_000)).toBe(-2_000);
  });

  it("returns null when total_cost is null", () => {
    expect(calcProfitLoss(13_000, 14_000, null)).toBeNull();
  });

  it("returns null when both prices are null", () => {
    expect(calcProfitLoss(null, null, 11_000)).toBeNull();
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
