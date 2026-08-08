/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import InventoryTable, { type VehicleListItem } from "../components/admin/InventoryTable";

const VEHICLES: VehicleListItem[] = [
  {
    vin: "1HGCM82633A004352", make: "Honda", model: "Accord", year: 2020, trim: "EX",
    status: "frontline_ready", ownership_status: "available", photography_status: "done",
    advertised_price_cargurus: 22000, advertised_price_facebook: null,
    purchase_date: "2026-01-01", sale_date: null,
    purchase_price: 18000, sale_price: null, expense_total: 500, commission_percentage: 10,
  },
  {
    vin: "2T1BURHE0JC123456", make: "Toyota", model: "Corolla", year: 2019, trim: null,
    status: "sold", ownership_status: "available", photography_status: "done",
    advertised_price_cargurus: 15000, advertised_price_facebook: null,
    purchase_date: "2025-11-01", sale_date: "2026-01-15",
    purchase_price: 12000, sale_price: 15000, expense_total: 200, commission_percentage: 5,
  },
];

describe("InventoryTable (render)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders rows and hides sold vehicles by default", () => {
    render(<InventoryTable vehicles={VEHICLES} />);
    expect(screen.getByText("Honda Accord")).toBeInTheDocument();
    // "Corolla" is sold and the default filter is "not sold".
    expect(screen.queryByText("Toyota Corolla")).not.toBeInTheDocument();
    expect(screen.getByText(/1 vehicle/)).toBeInTheDocument();
  });

  it("filters by free-text search", () => {
    render(<InventoryTable vehicles={VEHICLES} />);
    const search = screen.getByPlaceholderText(/Search VIN, make, or model/i);
    fireEvent.change(search, { target: { value: "Accord" } });
    expect(screen.getByText("Honda Accord")).toBeInTheDocument();
  });

  it("shows an empty state when no vehicles match", () => {
    render(<InventoryTable vehicles={VEHICLES} />);
    const search = screen.getByPlaceholderText(/Search VIN, make, or model/i);
    fireEvent.change(search, { target: { value: "nonexistent-vin" } });
    expect(screen.getByText(/No vehicles match the current filters\./i)).toBeInTheDocument();
  });

  it("disables Export CSV when there are no vehicles at all", () => {
    render(<InventoryTable vehicles={[]} />);
    expect(screen.getByRole("button", { name: /Export CSV/i })).toBeDisabled();
  });
});
