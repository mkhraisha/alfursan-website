import { useState } from "react";
import { BUSINESS_EXPENSE_CATEGORIES, TAX_TYPES, DEFAULT_TAX_TYPE, rateForTaxType } from "../../lib/vehicles";
import { buildStorageUrl } from "../../lib/media";
import AdminSearchBar from "./AdminSearchBar";

export type BusinessExpenseRow = {
  id: string;
  category: string;
  vendor: string | null;
  description: string;
  amount: number;
  expense_date: string;
  tax_amount: number | null;
  tax_type: string | null;
  tax_rate: number | null;
  receipt_file_path: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  expenses: BusinessExpenseRow[];
  supabaseUrl: string;
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

async function uploadReceipt(file: File): Promise<string> {
  const urlRes = await fetch("/api/expenses/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, fileSize: file.size, filename: file.name }),
  });
  if (!urlRes.ok) {
    const d = await urlRes.json().catch(() => ({}));
    throw new Error((d as { error?: string }).error ?? "Failed to get upload URL");
  }
  const { uploadUrl, storagePath } = (await urlRes.json()) as { uploadUrl: string; storagePath: string };
  const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!putRes.ok) throw new Error("Upload to storage failed");
  return storagePath;
}

export default function BusinessExpenses({ expenses: initial, supabaseUrl }: Props) {
  const [expenses, setExpenses] = useState(initial);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    category: "gas",
    vendor: "",
    description: "",
    amount: "",
    tax_type: DEFAULT_TAX_TYPE as string,
    tax_amount: "",
    file: null as File | null,
  });
  const [taxAmountTouched, setTaxAmountTouched] = useState(false);

  const q = search.trim().toLowerCase();
  const filtered = expenses.filter((e) => {
    if (!q) return true;
    return (
      e.description.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      (e.vendor ?? "").toLowerCase().includes(q)
    );
  });

  const subtotal = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  const taxTotal = filtered.reduce((sum, e) => sum + Number(e.tax_amount ?? 0), 0);

  function resetForm() {
    setForm({
      expense_date: new Date().toISOString().slice(0, 10),
      category: "gas",
      vendor: "",
      description: "",
      amount: "",
      tax_type: DEFAULT_TAX_TYPE,
      tax_amount: "",
      file: null,
    });
    setTaxAmountTouched(false);
  }

  function setAmount(amount: string) {
    setForm((f) => {
      const next = { ...f, amount };
      if (!taxAmountTouched) {
        const rate = rateForTaxType(f.tax_type) ?? 0;
        const n = parseFloat(amount);
        next.tax_amount = isNaN(n) ? "" : (n * rate).toFixed(2);
      }
      return next;
    });
  }

  function setTaxType(tax_type: string) {
    setForm((f) => {
      const next = { ...f, tax_type };
      if (!taxAmountTouched) {
        const rate = rateForTaxType(tax_type) ?? 0;
        const n = parseFloat(f.amount);
        next.tax_amount = isNaN(n) ? "" : (n * rate).toFixed(2);
      }
      return next;
    });
  }

  async function addExpense() {
    if (!form.expense_date || !form.description || !form.amount) return;
    setSaving(true);
    setError(null);
    try {
      const receipt_file_path = form.file ? await uploadReceipt(form.file) : undefined;
      const res = await fetch("/api/expenses/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expense_date: form.expense_date,
          category: form.category,
          vendor: form.vendor || undefined,
          description: form.description,
          amount: parseFloat(form.amount),
          tax_type: form.tax_type,
          tax_rate: rateForTaxType(form.tax_type),
          tax_amount: form.tax_amount ? parseFloat(form.tax_amount) : undefined,
          receipt_file_path,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError((d as { error?: string }).error ?? "Failed to add expense");
        return;
      }
      const created = (await res.json()) as BusinessExpenseRow;
      setExpenses((rows) => [created, ...rows]);
      resetForm();
      setShowAdd(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(id: string) {
    if (!confirm("Delete this business expense?")) return;
    const res = await fetch(`/api/expenses/business/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setExpenses((rows) => rows.filter((e) => e.id !== id));
    } else {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? "Delete failed");
    }
  }

  return (
    <div>
      <style>{`
        .be-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 12px; }
        .be-header h1 { font-size: 24px; font-weight: 800; color: #1a1d23; }
        .be-header p { color: #99a1b2; font-size: 14px; margin-top: 4px; }
        .be-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }

        .be-btn {
          display: inline-flex; align-items: center;
          padding: 8px 14px; border-radius: 6px; font-size: 14px; font-weight: 600;
          cursor: pointer; border: 1px solid #e4e7ec; background: #fff; color: #1a1d23;
          text-decoration: none;
        }
        .be-btn:hover { background: #f8f9fb; }
        .be-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .be-btn-primary { background: #1a7f4b; border-color: #1a7f4b; color: #fff; }
        .be-btn-primary:hover { background: #176f42; border-color: #176f42; }
        .be-btn-danger { background: #fff1f2; border-color: #fecdd3; color: #b42318; }
        .be-btn-danger:hover { background: #ffe4e6; }

        .be-section { background: #fff; border: 1px solid #e4e7ec; border-radius: 10px; overflow: hidden; }
        .be-wrap { overflow-x: auto; }
        .be-empty { padding: 40px; text-align: center; color: #99a1b2; font-size: 14px; }
        .be-error { margin-bottom: 12px; color: #b42318; font-size: 13px; }

        .be-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .be-table th {
          padding: 8px 14px; text-align: left; font-size: 10px; font-weight: 700; color: #99a1b2;
          text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e4e7ec;
          white-space: nowrap; background: #fafbfc;
        }
        .be-table td { padding: 10px 14px; border-bottom: 1px solid #f0f2f5; color: #1a1d23; vertical-align: middle; }
        .be-table tr:last-child td { border-bottom: none; }
        .be-table tr:hover td { background: #f8f9fb; }
        .be-table tfoot td { font-weight: 700; border-top: 2px solid #e4e7ec; background: #fafbfc; }
        .be-muted { color: #99a1b2; font-size: 12px; }

        .be-add { margin-bottom: 16px; border: 1px solid #e4e7ec; border-radius: 10px; background: #fff; padding: 16px; }
        .be-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 10px; }
        .be-field label { display: block; font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px; }
        .be-field input, .be-field select {
          width: 100%; padding: 9px 10px; border: 1px solid #e4e7ec; border-radius: 6px;
          font-size: 14px; font-family: inherit; color: #111827; background: #fff;
        }
        .be-field input:focus, .be-field select:focus { outline: 2px solid #B92111; border-color: transparent; }
      `}</style>

      <div className="be-header">
        <div>
          <h1>Business Expenses</h1>
          <p>Track dealership-level expenses with optional receipt/document attachments.</p>
        </div>
        <div className="be-header-actions">
          <a href="/admin/expenses/" className="be-btn">All Vehicle Expenses</a>
          <button type="button" className="be-btn be-btn-primary" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "Close" : "+ Add Business Expense"}
          </button>
        </div>
      </div>

      {error && <div className="be-error">{error}</div>}

      {showAdd && (
        <div className="be-add">
          <div className="be-grid">
            <div className="be-field">
              <label>Date *</label>
              <input type="date" value={form.expense_date} onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))} />
            </div>
            <div className="be-field">
              <label>Category *</label>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {BUSINESS_EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{fmtCategory(category)}</option>
                ))}
              </select>
            </div>
            <div className="be-field">
              <label>Vendor</label>
              <input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} placeholder="Who was paid" />
            </div>
            <div className="be-field">
              <label>Description *</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the expense" />
            </div>
            <div className="be-field">
              <label>Amount ($) *</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setAmount(e.target.value)} placeholder="Negative for refunds/credits" />
            </div>
            <div className="be-field">
              <label>Tax Type</label>
              <select value={form.tax_type} onChange={(e) => setTaxType(e.target.value)}>
                {TAX_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </div>
            <div className="be-field">
              <label>Tax Amount ($)</label>
              <input type="number" step="0.01" value={form.tax_amount} onChange={(e) => { setTaxAmountTouched(true); setForm((f) => ({ ...f, tax_amount: e.target.value })); }} />
            </div>
            <div className="be-field">
              <label>Receipt / Document (optional)</label>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))}
              />
            </div>
          </div>
          <button
            type="button"
            className="be-btn be-btn-primary"
            onClick={addExpense}
            disabled={saving || !form.expense_date || !form.description || !form.amount}
          >
            {saving ? "Saving…" : "Save Expense"}
          </button>
        </div>
      )}

      <AdminSearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search description, category, or vendor…"
        resultsLabel={`${filtered.length} ${filtered.length === 1 ? "expense" : "expenses"}`}
      />

      <div className="be-section">
        <div className="be-wrap">
          {filtered.length === 0 ? (
            <div className="be-empty">No business expenses found.</div>
          ) : (
            <table className="be-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Vendor</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Tax</th>
                  <th>Total</th>
                  <th>Receipt</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(e.expense_date)}</td>
                    <td>{fmtCategory(e.category)}</td>
                    <td>{e.vendor ?? <span className="be-muted">—</span>}</td>
                    <td>{e.description}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtMoney(e.amount)}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      {e.tax_amount != null ? fmtMoney(e.tax_amount) : <span className="be-muted">—</span>}
                      {e.tax_type && <div className="be-muted">{TAX_TYPES.find((t) => t.code === e.tax_type)?.label ?? e.tax_type}</div>}
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtMoney(e.amount + Number(e.tax_amount ?? 0))}</td>
                    <td>
                      {e.receipt_file_path ? (
                        <a href={buildStorageUrl(supabaseUrl, "vehicle-documents", e.receipt_file_path)} target="_blank" rel="noreferrer noopener">View ↗</a>
                      ) : (
                        <span className="be-muted">—</span>
                      )}
                    </td>
                    <td>
                      <button type="button" className="be-btn be-btn-danger" onClick={() => deleteExpense(e.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Total</td>
                  <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtMoney(subtotal)}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtMoney(taxTotal)}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtMoney(subtotal + taxTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
