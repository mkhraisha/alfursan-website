import { describe, it, expect } from "vitest";
import { toCSV } from "../lib/csv-export";
import { GARAGE_REGISTER_EXPORT_COLUMNS, type GarageVehicle } from "../components/admin/GarageRegister";

function makeVehicle(overrides: Partial<GarageVehicle> = {}): GarageVehicle {
  return {
    vin: "1HGCM82633A004352",
    make: "Honda",
    body_type: "sedan",
    colour: "Black",
    odometer: 42000,
    purchased_from_name: "Jane Doe",
    purchased_from_address: "123 Main St",
    purchase_date: "2024-01-15",
    purchaser_name: null,
    purchaser_address: null,
    sale_date: null,
    ...overrides,
  };
}

describe("GARAGE_REGISTER_EXPORT_COLUMNS", () => {
  it("exports every register field, hardcoding purpose as Resale", () => {
    const csv = toCSV([makeVehicle()], GARAGE_REGISTER_EXPORT_COLUMNS);
    const [header, data] = csv.split("\r\n");

    expect(header).toBe(
      [
        "Purchased From — Name", "Purchased From — Address", "Date Acquired", "Purpose",
        "VIN", "Make", "Style", "Colour", "Odometer (km)",
        "Sold To — Name", "Sold To — Address", "Date Sold",
      ].join(","),
    );
    expect(data).toBe(
      "Jane Doe,123 Main St,2024-01-15,Resale,1HGCM82633A004352,Honda,sedan,Black,42000,,,In Stock",
    );
  });

  it("uses the actual sale date once the vehicle has been sold", () => {
    const csv = toCSV(
      [makeVehicle({ purchaser_name: "John Smith", purchaser_address: "456 Oak Ave", sale_date: "2024-06-01" })],
      GARAGE_REGISTER_EXPORT_COLUMNS,
    );
    const data = csv.split("\r\n")[1];
    expect(data).toBe(
      "Jane Doe,123 Main St,2024-01-15,Resale,1HGCM82633A004352,Honda,sedan,Black,42000,John Smith,456 Oak Ave,2024-06-01",
    );
  });
});
