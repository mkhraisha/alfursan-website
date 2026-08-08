import { describe, it, expect } from "vitest";
import { validateExpenseForm } from "../components/admin/VehicleDetail";

function baseForm(overrides: Partial<Record<string, string>> = {}) {
  return {
    category: "repair",
    description: "Brake pad replacement",
    amount: "250.00",
    vendor: "",
    expense_date: "",
    tax_type: "HST_ON",
    tax_amount: "",
    ...overrides,
  };
}

describe("validateExpenseForm", () => {
  it("accepts a fully valid form", () => {
    expect(validateExpenseForm(baseForm())).toEqual({});
  });

  it("rejects a missing description", () => {
    expect(validateExpenseForm(baseForm({ description: "" })).description).toBeTruthy();
  });

  it("rejects a missing/non-numeric amount", () => {
    expect(validateExpenseForm(baseForm({ amount: "" })).amount).toBeTruthy();
    expect(validateExpenseForm(baseForm({ amount: "abc" })).amount).toBeTruthy();
  });

  it("rejects a zero amount", () => {
    expect(validateExpenseForm(baseForm({ amount: "0" })).amount).toBeTruthy();
  });

  it("accepts a negative amount (refunds/credits)", () => {
    expect(validateExpenseForm(baseForm({ amount: "-50" })).amount).toBeFalsy();
  });

  it("rejects a malformed expense_date", () => {
    expect(validateExpenseForm(baseForm({ expense_date: "01/15/2024" })).expense_date).toBeTruthy();
  });
});
