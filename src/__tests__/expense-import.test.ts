import { describe, it, expect } from "vitest";
import { parseReimbursedFlag, applyExpenseMapping, extractVin, parseExpenseDate } from "../lib/expense-import";

describe("parseExpenseDate", () => {
  it("parses M/D/YYYY", () => {
    expect(parseExpenseDate("9/13/2025")).toBe("2025-09-13");
  });

  it("parses M/D/YYYY with double-digit month and day", () => {
    expect(parseExpenseDate("12/31/2025")).toBe("2025-12-31");
  });

  it("parses M/D/YY (2-digit year)", () => {
    expect(parseExpenseDate("9/13/25")).toBe("2025-09-13");
  });

  it("passes through an already-ISO date", () => {
    expect(parseExpenseDate("2025-09-13")).toBe("2025-09-13");
  });

  it("returns null for unparseable input", () => {
    expect(parseExpenseDate("not a date")).toBeNull();
  });
});

describe("extractVin", () => {
  it("returns a bare VIN unchanged (uppercased)", () => {
    expect(extractVin("1hgcm82633a123456")).toBe("1HGCM82633A123456");
  });

  it("strips a trailing '(Year Make Model)' description", () => {
    expect(extractVin("2C4RDGBG9GR322649 (DODGE GRAND CARAVAN 2016)")).toBe("2C4RDGBG9GR322649");
  });

  it("handles extra whitespace before the parenthetical", () => {
    expect(extractVin("2HKRW2H92HH119980  (Honda CR-V 2017)")).toBe("2HKRW2H92HH119980");
  });
});

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

  it("strips a 'VIN (Year Make Model)' description from the VIN column", () => {
    const row = { VIN: "2C4RDGBG9GR322649 (DODGE GRAND CARAVAN 2016)", Category: "repair", Description: "x", Amount: "1" };
    expect(applyExpenseMapping(row, mapping).vin).toBe("2C4RDGBG9GR322649");
  });

  it("ignores unmapped columns", () => {
    const row = { VIN: "1HGCM82633A123456", Category: "repair", Description: "x", Amount: "1", Extra: "ignored" };
    const result = applyExpenseMapping(row, mapping);
    expect(result).not.toHaveProperty("Extra");
  });

  it("parses a negative amount as a refund/credit", () => {
    const row = { VIN: "1HGCM82633A123456", Category: "admin", Description: "Forfeited deposit", Amount: "-CA$500.00" };
    expect(applyExpenseMapping(row, mapping).amount).toBe(-500);
  });

  it("leaves vin unset when the Car cell is blank (general expense)", () => {
    const row = { VIN: "", Category: "admin", Description: "Office supplies", Amount: "10" };
    expect(applyExpenseMapping(row, mapping).vin).toBeUndefined();
  });

  it("maps vendor and expense_date fields", () => {
    const fullMapping = { ...mapping, Vendor: "vendor", Date: "expense_date" };
    const row = { VIN: "1HGCM82633A123456", Category: "repair", Description: "x", Amount: "1", Vendor: "Divine Motors", Date: "9/13/2025" };
    const result = applyExpenseMapping(row, fullMapping);
    expect(result.vendor).toBe("Divine Motors");
    expect(result.expense_date).toBe("2025-09-13");
  });

  it("omits expense_date when the date cell can't be parsed", () => {
    const fullMapping = { ...mapping, Date: "expense_date" };
    const row = { VIN: "1HGCM82633A123456", Category: "repair", Description: "x", Amount: "1", Date: "garbage" };
    expect(applyExpenseMapping(row, fullMapping).expense_date).toBeUndefined();
  });
});
