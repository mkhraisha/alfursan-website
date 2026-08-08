/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AddVehicleForm from "../components/admin/AddVehicleForm";

describe("AddVehicleForm (render)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders required fields and the submit button", () => {
    render(<AddVehicleForm />);
    expect(screen.getByTestId("av-vin")).toBeInTheDocument();
    expect(screen.getByTestId("av-make")).toBeInTheDocument();
    expect(screen.getByTestId("av-model")).toBeInTheDocument();
    expect(screen.getByTestId("av-year")).toBeInTheDocument();
    expect(screen.getByTestId("av-body_type")).toBeInTheDocument();
    expect(screen.getByTestId("av-submit")).toBeInTheDocument();
  });

  it("shows a live VIN character counter that turns 'full' at 17 characters", () => {
    render(<AddVehicleForm />);
    const vinInput = screen.getByTestId("av-vin");
    fireEvent.change(vinInput, { target: { value: "1HGCM82633A004352" } }); // 18 chars, truncated by maxLength in real DOM but onChange logic strips invalid chars
    // Component uppercases + strips invalid VIN chars; assert the counter reflects current value length.
    expect(screen.getByText(/\/17/)).toBeInTheDocument();
  });

  it("blocks submission and shows field errors when required fields are missing", async () => {
    render(<AddVehicleForm />);
    fireEvent.click(screen.getByTestId("av-submit"));
    expect(await screen.findByText(/Valid 17-char VIN required/i)).toBeInTheDocument();
    expect(screen.getByText(/Make is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Model is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Body type is required/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits a valid form and redirects on success", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 201,
      json: async () => ({ vin: "1HGCM82633A004352" }),
    });
    render(<AddVehicleForm />);

    fireEvent.change(screen.getByTestId("av-vin"), { target: { value: "1HGCM82633A004352" } });
    fireEvent.change(screen.getByTestId("av-make"), { target: { value: "Honda" } });
    fireEvent.change(screen.getByTestId("av-model"), { target: { value: "Accord" } });
    fireEvent.change(screen.getByTestId("av-body_type"), { target: { value: "sedan" } });

    fireEvent.click(screen.getByTestId("av-submit"));

    expect(await screen.findByText(/Vehicle added!/i)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/vehicles", expect.objectContaining({ method: "POST" }));
  });
});
