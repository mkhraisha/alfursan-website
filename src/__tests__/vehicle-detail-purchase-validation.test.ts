import { describe, it, expect } from "vitest";
import { validatePurchaseForm } from "../components/admin/VehicleDetail";

function baseForm(overrides: Partial<Record<string, string>> = {}) {
  return {
    purchase_date: "2024-01-15",
    purchase_price: "25,000",
    purchased_from_name: "Acme Auto Auction",
    purchased_from_address: "123 Main St, Toronto, ON",
    lead_source: "",
    purchaser_name: "",
    purchaser_address: "",
    ...overrides,
  };
}

describe("validatePurchaseForm", () => {
  it("accepts a fully valid form", () => {
    expect(validatePurchaseForm(baseForm())).toEqual({});
  });

  it("accepts an entirely empty form (all fields optional on PATCH)", () => {
    expect(
      validatePurchaseForm(baseForm({ purchase_date: "", purchase_price: "", purchased_from_name: "", purchased_from_address: "" }))
    ).toEqual({});
  });

  it("rejects a malformed purchase_date", () => {
    expect(validatePurchaseForm(baseForm({ purchase_date: "01/15/2024" })).purchase_date).toBeTruthy();
  });

  it("rejects a negative purchase_price", () => {
    expect(validatePurchaseForm(baseForm({ purchase_price: "-500" })).purchase_price).toBeTruthy();
  });
});
