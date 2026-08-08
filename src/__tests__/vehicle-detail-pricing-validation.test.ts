import { describe, it, expect } from "vitest";
import { validatePricingForm } from "../components/admin/VehicleDetail";

function baseForm(overrides: Partial<Record<string, string>> = {}) {
  return {
    wholesale_price: "18,000",
    advertised_price_cargurus: "22,500",
    advertised_price_facebook: "21,000",
    sale_price: "",
    sale_date: "",
    ...overrides,
  };
}

describe("validatePricingForm", () => {
  it("accepts a fully valid form with no purchase date on file", () => {
    expect(validatePricingForm(baseForm(), null)).toEqual({});
  });

  it("accepts an entirely empty form (all fields optional on PATCH)", () => {
    expect(
      validatePricingForm(baseForm({ wholesale_price: "", advertised_price_cargurus: "", advertised_price_facebook: "" }), null)
    ).toEqual({});
  });

  it("rejects a negative wholesale_price", () => {
    expect(validatePricingForm(baseForm({ wholesale_price: "-100" }), null).wholesale_price).toBeTruthy();
  });

  it("rejects a sale_date before the purchase_date", () => {
    const errs = validatePricingForm(baseForm({ sale_price: "20,000", sale_date: "2024-01-01" }), "2024-06-01");
    expect(errs.sale_date).toBeTruthy();
  });

  it("accepts a sale_date on or after the purchase_date", () => {
    expect(validatePricingForm(baseForm({ sale_price: "20,000", sale_date: "2024-06-01" }), "2024-06-01").sale_date).toBeFalsy();
    expect(validatePricingForm(baseForm({ sale_price: "20,000", sale_date: "2024-07-01" }), "2024-06-01").sale_date).toBeFalsy();
  });

  it("skips the cross-field check when there is no sale_date or no purchase_date", () => {
    expect(validatePricingForm(baseForm(), "2024-06-01").sale_date).toBeFalsy();
    expect(validatePricingForm(baseForm({ sale_date: "2024-01-01" }), null).sale_date).toBeFalsy();
  });
});
