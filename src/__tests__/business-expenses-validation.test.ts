import { describe, it, expect } from "vitest";
import { validateBusinessExpenseForm } from "../components/admin/BusinessExpenses";

function baseForm(overrides: Partial<Record<string, string>> = {}) {
  return {
    expense_date: "2024-06-01",
    category: "gas",
    vendor: "",
    description: "Fuel for delivery van",
    amount: "85.00",
    tax_type: "HST_ON",
    tax_amount: "",
    file: null,
    ...overrides,
  };
}

describe("validateBusinessExpenseForm", () => {
  it("accepts a fully valid form", () => {
    expect(validateBusinessExpenseForm(baseForm())).toEqual({});
  });

  it("rejects a missing description", () => {
    expect(validateBusinessExpenseForm(baseForm({ description: "" })).description).toBeTruthy();
  });

  it("rejects a missing/non-numeric amount", () => {
    expect(validateBusinessExpenseForm(baseForm({ amount: "" })).amount).toBeTruthy();
    expect(validateBusinessExpenseForm(baseForm({ amount: "abc" })).amount).toBeTruthy();
  });

  it("rejects a zero amount", () => {
    expect(validateBusinessExpenseForm(baseForm({ amount: "0" })).amount).toBeTruthy();
  });

  it("accepts a negative amount (refunds/credits)", () => {
    expect(validateBusinessExpenseForm(baseForm({ amount: "-20" })).amount).toBeFalsy();
  });

  it("rejects a missing expense_date (required, unlike vehicle expenses)", () => {
    expect(validateBusinessExpenseForm(baseForm({ expense_date: "" })).expense_date).toBeTruthy();
  });

  it("rejects a malformed expense_date", () => {
    expect(validateBusinessExpenseForm(baseForm({ expense_date: "06/01/2024" })).expense_date).toBeTruthy();
  });
});
