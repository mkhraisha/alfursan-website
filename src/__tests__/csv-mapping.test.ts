import { describe, it, expect } from "vitest";
import { resolveAutoMapping } from "../lib/csv-mapping";

const VEHICLE_FIELDS = [
  { value: "",                          label: "— Skip —" },
  { value: "vin",                       label: "VIN" },
  { value: "advertised_price_cargurus", label: "Advertised Price — CarGurus ($)" },
  { value: "advertised_price_facebook", label: "Advertised Price — Facebook ($)" },
  { value: "internal_notes",            label: "Internal Notes" },
  { value: "lead_source",               label: "Lead Source" },
];

describe("resolveAutoMapping", () => {
  it("maps a generic 'Advertised Price' column to CarGurus by default", () => {
    const mapping = resolveAutoMapping(["Advertised Price"], VEHICLE_FIELDS);
    expect(mapping["Advertised Price"]).toBe("advertised_price_cargurus");
  });

  it("maps 'Notes' to internal_notes", () => {
    const mapping = resolveAutoMapping(["Notes"], VEHICLE_FIELDS);
    expect(mapping["Notes"]).toBe("internal_notes");
  });

  it("maps 'Lead Source' directly via value match", () => {
    const mapping = resolveAutoMapping(["Lead Source"], VEHICLE_FIELDS);
    expect(mapping["Lead Source"]).toBe("lead_source");
  });

  it("still maps an explicit CarGurus column via label match", () => {
    const mapping = resolveAutoMapping(["Advertised Price — CarGurus ($)"], VEHICLE_FIELDS);
    expect(mapping["Advertised Price — CarGurus ($)"]).toBe("advertised_price_cargurus");
  });

  it("leaves unrecognized columns unmapped", () => {
    const mapping = resolveAutoMapping(["Some Random Column"], VEHICLE_FIELDS);
    expect(mapping["Some Random Column"]).toBeUndefined();
  });

  it("is case-insensitive", () => {
    const mapping = resolveAutoMapping(["ADVERTISED PRICE"], VEHICLE_FIELDS);
    expect(mapping["ADVERTISED PRICE"]).toBe("advertised_price_cargurus");
  });
});
