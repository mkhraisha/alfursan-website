import { describe, it, expect } from "vitest";
import { toCSV } from "../lib/csv-export";
import { EXPENSE_EXPORT_COLUMNS, type AllExpensesRow } from "../components/admin/AllExpenses";

function makeExpense(overrides: Partial<AllExpensesRow> = {}): AllExpensesRow {
  return {
    id: "exp-1",
    vin: "1HGCM82633A004352",
    category: "repair",
    description: "Brake pads",
    amount: 200,
    vendor: "Joe's Garage",
    expense_date: "2026-02-10",
    reimbursed: false,
    tax_amount: 26,
    tax_type: "HST_ON",
    tax_rate: 13,
    created_at: "2026-02-10T12:00:00.000Z",
    vehicles: { make: "Honda", model: "Accord", year: 2020 },
    ...overrides,
  };
}

describe("EXPENSE_EXPORT_COLUMNS", () => {
  it("exports human-readable labels and computed total for a vehicle-linked expense", () => {
    const csv = toCSV([makeExpense()], EXPENSE_EXPORT_COLUMNS);
    const [header, data] = csv.split("\r\n");

    expect(header).toBe(
      ["Date", "VIN", "Vehicle", "Category", "Vendor", "Description", "Amount", "Tax Type", "Tax Amount", "Total", "Reimbursed"].join(","),
    );
    expect(data).toBe(
      "2026-02-10,1HGCM82633A004352,2020 Honda Accord,Repair,Joe's Garage,Brake pads,200,HST (Ontario) — 13%,26,226,No",
    );
  });

  it("falls back to created_at when expense_date is null, and renders a general (no-VIN) expense with empty vehicle fields", () => {
    const e = makeExpense({
      vin: null,
      vehicles: null,
      expense_date: null,
      tax_amount: null,
      tax_type: null,
      reimbursed: true,
    });
    const csv = toCSV([e], EXPENSE_EXPORT_COLUMNS);
    const fields = csv.split("\r\n")[1].split(",");

    expect(fields[0]).toBe("2026-02-10T12:00:00.000Z"); // date falls back to created_at
    expect(fields[1]).toBe(""); // vin
    expect(fields[2]).toBe(""); // vehicle
    expect(fields[7]).toBe(""); // tax type
    expect(fields[8]).toBe(""); // tax amount
    expect(fields[10]).toBe("Yes"); // reimbursed
  });
});
