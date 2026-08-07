import { describe, it, expect } from "vitest";
import { validateVehicleForm, buildVehiclePayload } from "../components/admin/AddVehicleForm";

// Minimal valid base — individual tests override just the field(s) under test.
function baseForm(overrides: Partial<Parameters<typeof validateVehicleForm>[0]> = {}) {
  return {
    vin: "1HGCM82633A004352",
    make: "Toyota",
    model: "Camry",
    year: "2022",
    trim: "",
    series: "",
    body_type: "sedan",
    engine_type: "",
    colour: "",
    odometer: "",
    num_keys: "",
    drive_type: "",
    transmission: "",
    fuel_type: "",
    cylinders: "",
    doors: "",
    purchase_date: "",
    purchase_price: "",
    wholesale_price: "",
    advertised_price_cargurus: "",
    advertised_price_facebook: "",
    status: "",
    ...overrides,
  };
}

// ── validateVehicleForm ───────────────────────────────────────────────────────

describe("validateVehicleForm", () => {
  it("accepts a fully valid minimal form", () => {
    expect(validateVehicleForm(baseForm())).toEqual({});
  });

  it("rejects a missing/invalid VIN", () => {
    expect(validateVehicleForm(baseForm({ vin: "" })).vin).toBeTruthy();
    expect(validateVehicleForm(baseForm({ vin: "TOO-SHORT" })).vin).toBeTruthy();
  });

  it("rejects a missing make/model", () => {
    expect(validateVehicleForm(baseForm({ make: "  " })).make).toBeTruthy();
    expect(validateVehicleForm(baseForm({ model: "" })).model).toBeTruthy();
  });

  it("rejects an out-of-range year", () => {
    expect(validateVehicleForm(baseForm({ year: "1899" })).year).toBeTruthy();
    expect(validateVehicleForm(baseForm({ year: "2101" })).year).toBeTruthy();
    expect(validateVehicleForm(baseForm({ year: "" })).year).toBeTruthy();
  });

  it("rejects a missing body_type", () => {
    expect(validateVehicleForm(baseForm({ body_type: "" })).body_type).toBeTruthy();
  });
});

// ── buildVehiclePayload ───────────────────────────────────────────────────────

describe("buildVehiclePayload", () => {
  it("always includes the required fields", () => {
    const body = buildVehiclePayload(baseForm());
    expect(body).toMatchObject({
      vin: "1HGCM82633A004352",
      make: "Toyota",
      model: "Camry",
      year: 2022,
      body_type: "sedan",
      status: null,
    });
  });

  it("includes engine_type when set — regression test for the bug where it was silently dropped", () => {
    const body = buildVehiclePayload(baseForm({ engine_type: "2.5L 4-Cylinder" }));
    expect(body.engine_type).toBe("2.5L 4-Cylinder");
  });

  it("omits engine_type entirely when blank, rather than sending an empty string", () => {
    const body = buildVehiclePayload(baseForm({ engine_type: "" }));
    expect(body).not.toHaveProperty("engine_type");
  });

  it("trims whitespace on free-text fields", () => {
    const body = buildVehiclePayload(baseForm({ trim: "  SE  ", series: " XV70 ", colour: " Blue " }));
    expect(body.trim).toBe("SE");
    expect(body.series).toBe("XV70");
    expect(body.colour).toBe("Blue");
  });

  it("parses numeric fields, stripping thousands separators", () => {
    const body = buildVehiclePayload(baseForm({
      odometer: "12,500",
      num_keys: "2",
      cylinders: "4",
      doors: "4",
      purchase_price: "22,000",
      wholesale_price: "18,500",
      advertised_price_cargurus: "24,900",
      advertised_price_facebook: "23,500",
    }));
    expect(body.odometer).toBe(12_500);
    expect(body.num_keys).toBe(2);
    expect(body.cylinders).toBe(4);
    expect(body.doors).toBe(4);
    expect(body.purchase_price).toBe(22_000);
    expect(body.wholesale_price).toBe(18_500);
    expect(body.advertised_price_cargurus).toBe(24_900);
    expect(body.advertised_price_facebook).toBe(23_500);
  });

  it("passes through the enum-like select fields (drive_type, transmission, fuel_type) verbatim", () => {
    const body = buildVehiclePayload(baseForm({
      drive_type: "awd",
      transmission: "cvt",
      fuel_type: "hybrid",
    }));
    expect(body.drive_type).toBe("awd");
    expect(body.transmission).toBe("cvt");
    expect(body.fuel_type).toBe("hybrid");
  });

  it("includes purchase_date verbatim (not parsed) when set", () => {
    const body = buildVehiclePayload(baseForm({ purchase_date: "2026-01-15" }));
    expect(body.purchase_date).toBe("2026-01-15");
  });

  it("defaults status to null rather than an empty string", () => {
    const body = buildVehiclePayload(baseForm({ status: "" }));
    expect(body.status).toBeNull();
  });

  it("passes through status when set", () => {
    const body = buildVehiclePayload(baseForm({ status: "frontline_ready" }));
    expect(body.status).toBe("frontline_ready");
  });
});
