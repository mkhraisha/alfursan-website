import { describe, it, expect } from "vitest";
import { parseReimbursedFlag, applyExpenseMapping } from "../lib/expense-import";

describe("parseReimbursedFlag", () => {
  it("recognizes 'true'", () => {
    expect(parseReimbursedFlag("true")).toBe(true);
  });

  it("recognizes 'Yes'", () => {
    expect(parseReimbursedFlag("Yes")).toBe(true);
  });

  it("recognizes '1'", () => {
    expect(parseReimbursedFlag("1")).toBe(true);
  });

  it("returns false for 'no'", () => {
    expect(parseReimbursedFlag("no")).toBe(false);
  });

  it("returns false for '0'", () => {
    expect(parseReimbursedFlag("0")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(parseReimbursedFlag("")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(parseReimbursedFlag(undefined)).toBe(false);
  });

  it("trims whitespace", () => {
    expect(parseReimbursedFlag("  true  ")).toBe(true);
  });
});

describe("applyExpenseMapping", () => {
  const mapping = { VIN: "vin", Category: "category", Description: "description", Amount: "amount", Reimbursed: "reimbursed" };

  it("maps and coerces a full row", () => {
    const row = { VIN: "1hgcm82633a123456", Category: "Repair", Description: "Brake pads", Amount: "$1,234.56", Reimbursed: "yes" };
    expect(applyExpenseMapping(row, mapping)).toEqual({
      vin: "1HGCM82633A123456",
      category: "repair",
      description: "Brake pads",
      amount: 1234.56,
      reimbursed: true,
    });
  });

  it("skips empty cells", () => {
    const row = { VIN: "1HGCM82633A123456", Category: "repair", Description: "Oil change", Amount: "50", Reimbursed: "" };
    const result = applyExpenseMapping(row, mapping);
    expect(result.reimbursed).toBeUndefined();
  });

  it("uppercases VIN for matching against existing vehicles", () => {
    const row = { VIN: "1hgcm82633a123456", Category: "repair", Description: "x", Amount: "1" };
    expect(applyExpenseMapping(row, mapping).vin).toBe("1HGCM82633A123456");
  });

  it("ignores unmapped columns", () => {
    const row = { VIN: "1HGCM82633A123456", Category: "repair", Description: "x", Amount: "1", Extra: "ignored" };
    const result = applyExpenseMapping(row, mapping);
    expect(result).not.toHaveProperty("Extra");
  });
});
