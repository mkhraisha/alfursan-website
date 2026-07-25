import { useState } from "react";
import { TAX_TYPES } from "../../lib/vehicles";
import { toCSV, downloadCSV, type CSVColumn } from "../../lib/csv-export";

export type AllExpensesRow = {
  id: string;
  vin: string | null;
  category: string;
  description: string;
  amount: number;
  vendor: string | null;
  expense_date: string | null;
  reimbursed: boolean;
  tax_amount: number | null;
  tax_type: string | null;
  tax_rate: number | null;
  created_at: string;
  vehicles: { make: string; model: string; year: number } | null;
};

type Props = {
  expenses: AllExpensesRow[];
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function fmtMoney(n: number) {
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtCategory(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type ReimbursedFilter = "all" | "reimbursed" | "unreimbursed";

export const EXPENSE_EXPORT_COLUMNS: CSVColumn<AllExpensesRow>[] = [
  { key: "date", label: "Date", value: (e) => e.expense_date ?? e.created_at },
  { key: "vin", label: "VIN", value: (e) => e.vin },
  { key: "vehicle", label: "Vehicle", value: (e) => (e.vehicles ? `${e.vehicles.year} ${e.vehicles.make} ${e.vehicles.model}` : null) },
  { key: "category", label: "Category", value: (e) => fmtCategory(e.category) },
  { key: "vendor", label: "Vendor", value: (e) => e.vendor },
  { key: "description", label: "Description", value: (e) => e.description },
  { key: "amount", label: "Amount", value: (e) => e.amount },
  { key: "tax_type", label: "Tax Type", value: (e) => (e.tax_type ? TAX_TYPES.find((t) => t.code === e.tax_type)?.label ?? e.tax_type : null) },
  { key: "tax_amount", label: "Tax Amount", value: (e) => e.tax_amount },
  { key: "total", label: "Total", value: (e) => e.amount + Number(e.tax_amount ?? 0) },
  { key: "reimbursed", label: "Reimbursed", value: (e) => (e.reimbursed ? "Yes" : "No") },
];

export default function AllExpenses({ expenses: initial }: Props) {
  const [expenses, setExpenses] = useState<AllExpensesRow[]>(initial);
  const [search, setSearch] = useState("");
  const [reimbursedFilter, setReimbursedFilter] = useState<ReimbursedFilter>("all");

  const q = search.toLowerCase();
  const filtered = expenses.filter((e) => {
    if (reimbursedFilter === "reimbursed" && !e.reimbursed) return false;
    if (reimbursedFilter === "unreimbursed" && e.reimbursed) return false;
    if (!search) return true;
    return (
      e.description.toLowerCase().includes(q) ||
      (e.vendor ?? "").toLowerCase().includes(q) ||
      (e.vin ?? "").toLowerCase().includes(q) ||
      (e.vehicles ? `${e.vehicles.make} ${e.vehicles.model}`.toLowerCase().includes(q) : false)
    );
  });

  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const taxTotal = filtered.reduce((s, e) => s + Number(e.tax_amount ?? 0), 0);

  async function toggleReimbursed(id: string, reimbursed: boolean) {
    setExpenses((es) => es.map((e) => (e.id === id ? { ...e, reimbursed } : e)));
    const res = await fetch(`/api/vehicles/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reimbursed }),
    });
    if (!res.ok) {
      setExpenses((es) => es.map((e) => (e.id === id ? { ...e, reimbursed: !reimbursed } : e)));
    }
  }

  function handleExportCSV() {
    const csv = toCSV(filtered, EXPENSE_EXPORT_COLUMNS);
    downloadCSV(`expenses-export-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div>
      <style>{`
        .ae-header { margin-bottom: 20px; }
        .ae-header h1 { font-size: 24px; font-weight: 800; color: #1a1d23; }
        .ae-header p { color: #99a1b2; font-size: 14px; margin-top: 4px; }

        .ae-toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
        .ae-search {
          flex: 1; min-width: 200px; max-width: 360px;
          padding: 9px 12px; border: 1px solid #e4e7ec; border-radius: 6px;
          font-size: 14px; font-family: inherit; color: #1a1d23; background: #fff;
        }
        .ae-search:focus { outline: 2px solid #B92111; border-color: transparent; }
        .ae-select {
          padding: 9px 12px; border: 1px solid #e4e7ec; border-radius: 6px;
          font-size: 14px; font-family: inherit; color: #1a1d23; background: #fff;
        }
        .ae-count { color: #99a1b2; font-size: 13px; margin-left: auto; }
        .ae-btn {
          padding: 8px 14px; border-radius: 6px; font-size: 14px; font-weight: 600;
          cursor: pointer; border: 1px solid #e4e7ec; background: #fff; color: #1a1d23;
        }
        .ae-btn:hover { background: #f8f9fb; }
        .ae-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .ae-section { background: #fff; border: 1px solid #e4e7ec; border-radius: 10px; overflow: hidden; }
        .ae-wrap { overflow-x: auto; }
        .ae-empty { padding: 40px; text-align: center; color: #99a1b2; font-size: 14px; }

        .ae-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .ae-table th {
          padding: 8px 14px; text-align: left; font-size: 10px; font-weight: 700; color: #99a1b2;
          text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e4e7ec;
          white-space: nowrap; background: #fafbfc;
        }
        .ae-table td { padding: 10px 14px; border-bottom: 1px solid #f0f2f5; color: #1a1d23; vertical-align: middle; }
        .ae-table tr:last-child td { border-bottom: none; }
        .ae-table tr:hover td { background: #f8f9fb; }
        .ae-table tfoot td { font-weight: 700; border-top: 2px solid #e4e7ec; background: #fafbfc; }

        .ae-muted { color: #99a1b2; font-size: 12px; }
        .ae-vin-link { text-decoration: none; color: #3b82f6; font-family: monospace; font-size: 11px; }
        .ae-vin-link:hover { text-decoration: underline; }
      `}</style>

      <div className="ae-header">
        <h1>All Expenses</h1>
        <p>Every expense across inventory — vehicle-linked and general admin/business costs.</p>
      </div>

      <div className="ae-toolbar">
        <input
          type="search"
          className="ae-search"
          placeholder="Search description, vendor, VIN, or vehicle…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="ae-select" value={reimbursedFilter} onChange={(e) => setReimbursedFilter(e.target.value as ReimbursedFilter)}>
          <option value="all">All</option>
          <option value="reimbursed">Reimbursed</option>
          <option value="unreimbursed">Not reimbursed</option>
        </select>
        <span className="ae-count">{filtered.length} {filtered.length === 1 ? "expense" : "expenses"}</span>
        <button type="button" className="ae-btn" onClick={handleExportCSV} disabled={filtered.length === 0}>
          Export CSV
        </button>
      </div>

      <div className="ae-section">
        <div className="ae-wrap">
          {filtered.length === 0 ? (
            <div className="ae-empty">No expenses found.</div>
          ) : (
            <table className="ae-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Vehicle</th>
                  <th>Category</th>
                  <th>Vendor</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Tax</th>
                  <th>Total</th>
                  <th>Reimbursed</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(e.expense_date ?? e.created_at)}</td>
                    <td>
                      {e.vin ? (
                        <div>
                          <a href={`/admin/inventory/${e.vin}`} className="ae-vin-link">{e.vin}</a>
                          {e.vehicles && <div className="ae-muted">{e.vehicles.year} {e.vehicles.make} {e.vehicles.model}</div>}
                        </div>
                      ) : (
                        <span className="ae-muted">— General —</span>
                      )}
                    </td>
                    <td>{fmtCategory(e.category)}</td>
                    <td>{e.vendor ?? <span className="ae-muted">—</span>}</td>
                    <td>{e.description}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtMoney(e.amount)}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      {e.tax_amount != null ? fmtMoney(e.tax_amount) : <span className="ae-muted">—</span>}
                      {e.tax_type && <div className="ae-muted">{TAX_TYPES.find((t) => t.code === e.tax_type)?.label ?? e.tax_type}</div>}
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtMoney(e.amount + Number(e.tax_amount ?? 0))}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={e.reimbursed}
                        onChange={(ev) => toggleReimbursed(e.id, ev.target.checked)}
                        aria-label={`Mark ${e.description} as reimbursed`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>Total</td>
                  <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtMoney(total)}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtMoney(taxTotal)}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtMoney(total + taxTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
