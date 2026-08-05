import { describe, it, expect } from "vitest";
import {
  computeCompletenessReport,
  COMPLETENESS_FIELDS,
  type CompletenessVehicleInput,
} from "../lib/vehicles";

function vehicle(overrides: Partial<CompletenessVehicleInput> = {}): CompletenessVehicleInput {
  // A vehicle with every completeness field populated — tests override specific
  // fields down to a "missing" value (null/undefined/"" /[]) to exercise a gap.
  return {
    vin: "1HGCM82633A123456",
    make: "Honda",
    model: "Accord",
    year: 2020,
    status: "frontline_ready",
    sale_date: null,
    description: "A great car.",
    images_json: ["photo1.jpg"],
    advertised_price_cargurus: 20_000,
    trim: "EX",
    engine_type: "2.0L I4",
    drive_type: "fwd",
    transmission: "automatic",
    fuel_type: "gasoline",
    cylinders: 4,
    doors: 4,
    colour: "Black",
    purchased_from_name: "Jane Doe",
    purchased_from_address: "123 Main St",
    ...overrides,
  };
}

describe("computeCompletenessReport", () => {
  it("returns no rows and zero stats for an empty inventory", () => {
    const report = computeCompletenessReport([]);
    expect(report.rows).toEqual([]);
    expect(report.totalVehicles).toBe(0);
    expect(report.activeVehicles).toBe(0);
    expect(report.averageMissingActive).toBe(0);
    expect(report.fieldFrequency.every((f) => f.missingCount === 0)).toBe(true);
  });

  it("omits a fully-complete vehicle from rows", () => {
    const report = computeCompletenessReport([vehicle()]);
    expect(report.rows).toEqual([]);
    expect(report.activeVehicles).toBe(1);
  });

  it("flags a null field as missing", () => {
    const report = computeCompletenessReport([vehicle({ description: null })]);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].missingFields.map((f) => f.key)).toEqual(["description"]);
  });

  it("flags an empty string as missing", () => {
    const report = computeCompletenessReport([vehicle({ colour: "" })]);
    expect(report.rows[0].missingFields.map((f) => f.key)).toEqual(["colour"]);
  });

  it("flags a whitespace-only string as missing", () => {
    const report = computeCompletenessReport([vehicle({ trim: "   " })]);
    expect(report.rows[0].missingFields.map((f) => f.key)).toEqual(["trim"]);
  });

  it("flags an empty array as missing but keeps a non-empty array present", () => {
    const report = computeCompletenessReport([vehicle({ images_json: [] })]);
    expect(report.rows[0].missingFields.map((f) => f.key)).toEqual(["images_json"]);
  });

  it("does not flag a numeric field as missing just because it's falsy-adjacent (0 is not used, but present values pass)", () => {
    const report = computeCompletenessReport([vehicle({ cylinders: 4, doors: 2 })]);
    expect(report.rows).toEqual([]);
  });

  it("sorts rows with the most missing fields first", () => {
    const oneGap = vehicle({ vin: "1FTFW1ET1EFA00001", colour: null });
    const threeGaps = vehicle({ vin: "1FTFW1ET1EFA00002", colour: null, trim: null, doors: null });
    const report = computeCompletenessReport([oneGap, threeGaps]);
    expect(report.rows.map((r) => r.vin)).toEqual(["1FTFW1ET1EFA00002", "1FTFW1ET1EFA00001"]);
  });

  it("includes a sold vehicle's gaps in rows but excludes it from active stats", () => {
    const sold = vehicle({ sale_date: "2026-01-15", description: null });
    const report = computeCompletenessReport([sold]);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].active).toBe(false);
    expect(report.activeVehicles).toBe(0);
    expect(report.averageMissingActive).toBe(0);
    const descFreq = report.fieldFrequency.find((f) => f.key === "description")!;
    expect(descFreq.missingCount).toBe(0);
  });

  it("computes field frequency and percentage across active vehicles only", () => {
    const a = vehicle({ vin: "1FTFW1ET1EFA00001", description: null });
    const b = vehicle({ vin: "1FTFW1ET1EFA00002", description: null });
    const c = vehicle({ vin: "1FTFW1ET1EFA00003" }); // complete
    const report = computeCompletenessReport([a, b, c]);
    const descFreq = report.fieldFrequency.find((f) => f.key === "description")!;
    expect(descFreq.missingCount).toBe(2);
    expect(descFreq.missingPct).toBeCloseTo(66.7, 1);
  });

  it("sorts fieldFrequency worst (most missing) first", () => {
    const a = vehicle({ vin: "1FTFW1ET1EFA00001", colour: null, doors: null, trim: null });
    const b = vehicle({ vin: "1FTFW1ET1EFA00002", colour: null });
    const report = computeCompletenessReport([a, b]);
    expect(report.fieldFrequency[0].key).toBe("colour");
    expect(report.fieldFrequency[0].missingCount).toBe(2);
  });

  it("computes averageMissingActive across active vehicles only", () => {
    const a = vehicle({ vin: "1FTFW1ET1EFA00001", colour: null, doors: null });
    const b = vehicle({ vin: "1FTFW1ET1EFA00002" });
    const report = computeCompletenessReport([a, b]);
    expect(report.averageMissingActive).toBe(1);
  });

  it("categorizes every defined field as compliance, listing, or spec", () => {
    for (const f of COMPLETENESS_FIELDS) {
      expect(["compliance", "listing", "spec"]).toContain(f.category);
    }
  });
});
