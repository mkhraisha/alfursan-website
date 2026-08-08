/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import VehicleDetail, { type VehicleFull } from "../components/admin/VehicleDetail";

const VEHICLE: VehicleFull = {
  vin: "1HGCM82633A004352",
  make: "Honda", model: "Accord", trim: null, series: null, body_type: "sedan",
  engine_type: null, num_keys: null, drive_type: null, transmission: null,
  fuel_type: null, cylinders: null, doors: null, features: [], description: null,
  year: 2020, colour: null, odometer: 45000,
  purchase_date: "2026-01-01", purchase_price: 15000,
  purchased_from_name: null, purchased_from_address: null,
  purchaser_name: null, purchaser_address: null,
  wholesale_price: null, advertised_price_cargurus: null, advertised_price_facebook: null,
  sale_price: null, sale_date: null,
  ownership_status: null, status: "frontline_ready", photography_status: null,
  acquisition_bill_of_sale_path: null, safety_inspection_document_path: null,
  signed_bill_of_sale_path: null, signed_ownership_sale_picture_path: null,
  signed_ownership_acquisition_picture_path: null,
  commission_user_id: null, images_json: [], videos_json: [],
  carfax_link: null, lead_source: null, internal_notes: null, disclosures: null,
};

describe("VehicleDetail — Basics tab validation (render)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function renderBasics() {
    render(
      <VehicleDetail vehicle={VEHICLE} expenses={[]} documents={[]} users={[]} supabaseUrl="https://test.supabase.co" />
    );
  }

  it("shows inline field errors and blocks the save when required fields are cleared", async () => {
    renderBasics();
    fireEvent.change(screen.getByTestId("vd-make"), { target: { value: "" } });
    fireEvent.change(screen.getByTestId("vd-model"), { target: { value: "" } });
    // fireEvent.submit bypasses jsdom's native `required` constraint validation
    // (which would otherwise block a click before React's onSubmit ever runs)
    // so this exercises our own zod-backed validateBasicsForm instead.
    fireEvent.submit(screen.getByTestId("vd-save-basics").closest("form")!);

    expect(await screen.findByText(/Make is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Model is required/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("clears a field's inline error as soon as it's edited", async () => {
    renderBasics();
    fireEvent.change(screen.getByTestId("vd-make"), { target: { value: "" } });
    fireEvent.submit(screen.getByTestId("vd-save-basics").closest("form")!);
    expect(await screen.findByText(/Make is required/i)).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("vd-make"), { target: { value: "Toyota" } });
    expect(screen.queryByText(/Make is required/i)).not.toBeInTheDocument();
  });

  it("saves successfully and shows a toast once fields are valid", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    renderBasics();
    fireEvent.click(screen.getByTestId("vd-save-basics"));

    expect(await screen.findByText("Saved!")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      `/api/vehicles/${VEHICLE.vin}`,
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("merges server-side field errors from a failed save into the inline messages", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Validation failed", errors: { colour: ["Colour is too long"] } }),
    });
    renderBasics();
    fireEvent.click(screen.getByTestId("vd-save-basics"));

    expect(await screen.findByText(/Colour is too long/i)).toBeInTheDocument();
  });
});

describe("VehicleDetail — Expenses tab validation (render)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows an inline error and blocks the add-expense submit when the description is missing", () => {
    render(
      <VehicleDetail vehicle={VEHICLE} expenses={[]} documents={[]} users={[]} supabaseUrl="https://test.supabase.co" />
    );
    fireEvent.click(screen.getByTestId("vd-tab-expenses"));
    fireEvent.click(screen.getByRole("button", { name: /\+ Add Expense/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Add Expense$/i }));

    expect(screen.getByText(/Description is required/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
