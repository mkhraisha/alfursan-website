/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BusinessExpenses, { type BusinessExpenseRow } from "../components/admin/BusinessExpenses";

const EXPENSES: BusinessExpenseRow[] = [
  {
    id: "be-1", category: "gas", vendor: "Petro Canada", description: "Fuel",
    amount: 100, expense_date: "2026-07-25", tax_amount: 13, tax_type: "HST_ON", tax_rate: 0.13,
    receipt_file_path: null, created_at: "2026-07-25T00:00:00Z", updated_at: "2026-07-25T00:00:00Z",
  },
];

describe("BusinessExpenses", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the expense list with totals", () => {
    render(<BusinessExpenses expenses={EXPENSES} supabaseUrl="https://test.supabase.co" />);
    expect(screen.getByText("Fuel")).toBeInTheDocument();
    expect(screen.getByText("Gas")).toBeInTheDocument();
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
  });

  it("shows an empty state when there are no expenses", () => {
    render(<BusinessExpenses expenses={[]} supabaseUrl="https://test.supabase.co" />);
    expect(screen.getByText(/No business expenses found\./i)).toBeInTheDocument();
  });

  it("filters the list via the search bar", () => {
    render(<BusinessExpenses expenses={EXPENSES} supabaseUrl="https://test.supabase.co" />);
    const search = screen.getByPlaceholderText(/Search description, category, or vendor/i);
    fireEvent.change(search, { target: { value: "nonexistent" } });
    expect(screen.getByText(/No business expenses found\./i)).toBeInTheDocument();
  });

  it("toggles the add-expense form open and closed", () => {
    render(<BusinessExpenses expenses={EXPENSES} supabaseUrl="https://test.supabase.co" />);
    const toggle = screen.getByRole("button", { name: /\+ Add Business Expense/i });
    expect(screen.queryByLabelText(/Description \*/i)).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByText(/Description \*/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Close/i }));
    expect(screen.queryByText(/Description \*/i)).not.toBeInTheDocument();
  });

  it("disables Save Expense until required fields are filled", () => {
    render(<BusinessExpenses expenses={EXPENSES} supabaseUrl="https://test.supabase.co" />);
    fireEvent.click(screen.getByRole("button", { name: /\+ Add Business Expense/i }));
    expect(screen.getByRole("button", { name: /Save Expense/i })).toBeDisabled();
  });

  it("adds a new expense on successful submission", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "be-2", category: "gas", vendor: null, description: "Oil change",
        amount: 50, expense_date: "2026-08-01", tax_amount: null, tax_type: null, tax_rate: null,
        receipt_file_path: null, created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
      }),
    });

    render(<BusinessExpenses expenses={EXPENSES} supabaseUrl="https://test.supabase.co" />);
    fireEvent.click(screen.getByRole("button", { name: /\+ Add Business Expense/i }));

    const [, descriptionInput] = screen.getAllByRole("textbox");
    fireEvent.change(descriptionInput, { target: { value: "Oil change" } });
    fireEvent.change(screen.getByPlaceholderText(/Negative for refunds\/credits/i), { target: { value: "50" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Expense/i }));

    expect(await screen.findByText("Oil change")).toBeInTheDocument();
  });
});
