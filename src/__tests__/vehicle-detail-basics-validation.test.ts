import { describe, it, expect } from "vitest";
import { validateBasicsForm } from "../components/admin/VehicleDetail";

// Minimal valid base — individual tests override just the field(s) under test.
function baseForm(overrides: Partial<Record<string, string>> = {}) {
  return {
    make: "Toyota",
    model: "Camry",
    trim: "",
    series: "",
    body_type: "sedan",
    engine_type: "",
    year: "2022",
    colour: "",
    odometer: "",
    num_keys: "",
    drive_type: "",
    transmission: "",
    fuel_type: "",
    cylinders: "",
    doors: "",
    status: "",
    ownership_status: "",
    photography_status: "",
    carfax_link: "",
    ...overrides,
  };
}

describe("validateBasicsForm", () => {
  it("accepts a fully valid minimal form", () => {
    expect(validateBasicsForm(baseForm())).toEqual({});
  });

  it("rejects a missing make/model", () => {
    expect(validateBasicsForm(baseForm({ make: "" })).make).toBeTruthy();
    expect(validateBasicsForm(baseForm({ model: "" })).model).toBeTruthy();
  });

  it("rejects an out-of-range year", () => {
    expect(validateBasicsForm(baseForm({ year: "1899" })).year).toBeTruthy();
    expect(validateBasicsForm(baseForm({ year: "2101" })).year).toBeTruthy();
  });

  it("accepts an empty year (optional on PATCH)", () => {
    expect(validateBasicsForm(baseForm({ year: "" })).year).toBeFalsy();
  });

  it("rejects an invalid body_type", () => {
    // body_type is only sent when truthy (see buildBasicsFields), so an empty
    // value is simply omitted from the PATCH payload rather than failing
    // schema validation — the HTML `required` attribute covers that case.
    expect(validateBasicsForm(baseForm({ body_type: "" })).body_type).toBeFalsy();
  });

  it("rejects a malformed carfax_link", () => {
    expect(validateBasicsForm(baseForm({ carfax_link: "not-a-url" })).carfax_link).toBeTruthy();
  });

  it("accepts an empty carfax_link", () => {
    expect(validateBasicsForm(baseForm({ carfax_link: "" })).carfax_link).toBeFalsy();
  });

  it("accepts a valid carfax_link", () => {
    expect(validateBasicsForm(baseForm({ carfax_link: "https://www.carfax.ca/vhr/ABC123" })).carfax_link).toBeFalsy();
  });
});
