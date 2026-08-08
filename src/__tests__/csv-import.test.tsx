/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CSVImport from "../components/admin/CSVImport";

function makeFile(name: string, content: string, type = "text/csv") {
  const file = new File([content], name, { type });
  return file;
}

describe("CSVImport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the upload zone with default hint text", () => {
    render(<CSVImport />);
    expect(screen.getByText(/Click to select or drag & drop a CSV file/i)).toBeInTheDocument();
    expect(screen.getByText(/Accepts \.csv files/i)).toBeInTheDocument();
  });

  it("rejects a non-csv file with an error message", async () => {
    render(<CSVImport />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const badFile = makeFile("photo.png", "not csv", "image/png");
    fireEvent.change(input, { target: { files: [badFile] } });
    expect(await screen.findByText(/Please select a \.csv file\./i)).toBeInTheDocument();
  });

  it("rejects a csv file larger than the 4MB limit", async () => {
    render(<CSVImport />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const big = makeFile("big.csv", "vin,make\n");
    Object.defineProperty(big, "size", { value: 5 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByText(/CSV is too large for direct import preview/i)).toBeInTheDocument();
  });

  it("toggles the upload-zone--dragging class on drag over/leave", () => {
    render(<CSVImport />);
    const label = document.querySelector("label.upload-zone") as HTMLLabelElement;
    expect(label.className).not.toContain("upload-zone--dragging");

    fireEvent.dragOver(label, { dataTransfer: { files: [] } });
    expect(label.className).toContain("upload-zone--dragging");

    fireEvent.dragLeave(label, { dataTransfer: { files: [] } });
    expect(label.className).not.toContain("upload-zone--dragging");
  });

  it("accepts a valid csv, parses headers, and enables Next once mapped to VIN", async () => {
    render(<CSVImport />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const csv = makeFile("vehicles.csv", "VIN,Make,Model\n1HGCM82633A004352,Honda,Accord\n");
    fireEvent.change(input, { target: { files: [csv] } });

    // File accepted -> upload zone shows filled state with file name.
    expect(await screen.findByText("vehicles.csv")).toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: /Next: Map Columns/i });
    expect(nextBtn).not.toBeDisabled();
    fireEvent.click(nextBtn);

    // Now on the mapping step — VIN column should already be auto-mapped.
    expect(await screen.findByText(/Map each CSV column to a vehicle field/i)).toBeInTheDocument();
    expect(document.querySelector("select.map-select--mapped")).not.toBeNull();
  });
});
