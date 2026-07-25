import { describe, it, expect } from "vitest";
import { toCSV } from "../lib/csv-export";
import { INVENTORY_EXPORT_COLUMNS, type VehicleListItem } from "../components/admin/InventoryTable";
import { calcTotalCost, calcProfitLoss, calcCommission } from "../lib/vehicles";

function makeVehicle(overrides: Partial<VehicleListItem> = {}): VehicleListItem {
  return {
    vin: "1HGCM82633A004352",
    make: "Honda",
    model: "Accord",
    year: 2020,
    trim: "EX-L",
    status: "frontline_ready",
    ownership_status: "available",
    photography_status: "done",
    advertised_price_cargurus: 25000,
    advertised_price_facebook: 24500,
    purchase_date: "2024-01-15",
    sale_date: null,
    purchase_price: 18000,
    sale_price: null,
    expense_total: 500,
    commission_percentage: 10,
    ...overrides,
  };
}

// Mirrors computeRow() in InventoryTable.tsx
function computeRow(v: VehicleListItem) {
  const totalCost = calcTotalCost(v.purchase_price, v.expense_total);
  const profitLoss = calcProfitLoss(v.sale_price, totalCost);
  const commission = calcCommission(profitLoss, v.commission_percentage);
  return { ...v, totalCost, profitLoss, commission };
}

describe("INVENTORY_EXPORT_COLUMNS", () => {
  it("exports human-readable labels for enum fields and raw values for the rest", () => {
    const row = computeRow(makeVehicle());
    const csv = toCSV([row], INVENTORY_EXPORT_COLUMNS);
    const [header, data] = csv.split("\r\n");

    expect(header).toBe(
      [
        "VIN", "Make", "Model", "Year", "Trim", "Status", "Ownership", "Photography",
        "Purchase Date", "Sale Date", "Listed Price (CarGurus)", "Listed Price (Facebook)",
        "Purchase Price", "Expense Total", "Total Cost", "Sale Price", "Profit / Loss", "Commission",
      ].join(","),
    );
    expect(data).toBe(
      "1HGCM82633A004352,Honda,Accord,2020,EX-L,Frontline Ready,Available,Done,2024-01-15,,25000,24500,18000,500,18500,,,",
    );
  });

  it("renders null enum/date fields as empty CSV fields", () => {
    const row = computeRow(makeVehicle({ status: null, ownership_status: null, photography_status: null, sale_date: null }));
    const csv = toCSV([row], INVENTORY_EXPORT_COLUMNS);
    const data = csv.split("\r\n")[1];
    const fields = data.split(",");
    expect(fields[5]).toBe(""); // status
    expect(fields[6]).toBe(""); // ownership
    expect(fields[7]).toBe(""); // photography
  });
});
