/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ExpenseCSVImport from "../components/admin/ExpenseCSVImport";

function makeFile(name: string, content: string, type = "text/csv") {
  return new File([content], name, { type });
}

describe("ExpenseCSVImport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the upload zone with default hint text", () => {
    render(<ExpenseCSVImport />);
    expect(screen.getByText(/Click to select or drag & drop a CSV file/i)).toBeInTheDocument();
  });

  it("rejects a non-csv file with an error message", async () => {
    render(<ExpenseCSVImport />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("notes.txt", "hi", "application/msword")] } });
    expect(await screen.findByText(/Please select a \.csv file\./i)).toBeInTheDocument();
  });

  it("rejects a csv file larger than the 4MB limit", async () => {
    render(<ExpenseCSVImport />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const big = makeFile("big.csv", "category,description,amount\n");
    Object.defineProperty(big, "size", { value: 5 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByText(/CSV is too large for direct import preview/i)).toBeInTheDocument();
  });

  it("toggles the upload-zone--dragging class on drag over/leave", () => {
    render(<ExpenseCSVImport />);
    const label = document.querySelector("label.upload-zone") as HTMLLabelElement;
    fireEvent.dragOver(label, { dataTransfer: { files: [] } });
    expect(label.className).toContain("upload-zone--dragging");
    fireEvent.dragLeave(label, { dataTransfer: { files: [] } });
    expect(label.className).not.toContain("upload-zone--dragging");
  });

  it("disables Preview until Category, Description, and Amount are all mapped", async () => {
    render(<ExpenseCSVImport />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    // Header names deliberately don't auto-map (so mapping starts empty).
    const csv = makeFile("expenses.csv", "Col A,Col B,Col C\nrepair,Fix,100\n");
    fireEvent.change(input, { target: { files: [csv] } });
    expect(await screen.findByText("expenses.csv")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Next: Map Columns/i }));
    expect(await screen.findByText(/Map each CSV column to an expense field/i)).toBeInTheDocument();

    const previewBtn = screen.getByRole("button", { name: /Preview →/i });
    expect(previewBtn).toBeDisabled();
  });
});
