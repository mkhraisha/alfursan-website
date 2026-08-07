import { useState, useMemo, useCallback } from "react";
import { calcTotalCost, calcProfitLoss, calcCommission } from "../../lib/vehicles";
import { toCSV, downloadCSV, type CSVColumn } from "../../lib/csv-export";
import AdminSearchBar from "./AdminSearchBar";

// ── Types ─────────────────────────────────────────────────────────────────────

export type VehicleListItem = {
  vin: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  status: string | null;
  ownership_status: string | null;
  photography_status: string | null;
  advertised_price_cargurus: number | null;
  advertised_price_facebook: number | null;
  purchase_date: string | null;
  sale_date: string | null;
  purchase_price: number | null;
  sale_price: number | null;
  expense_total: number;
  commission_percentage: number | null;
};

export type SortKey = "vin" | "make" | "year" | "advertised_price_cargurus" | "total_cost" | "profit_loss" | "purchase_date";
export type SortDir = "asc" | "desc";

/** Default inventory sort — oldest purchase first. */
export const DEFAULT_SORT_KEY: SortKey = "purchase_date";
export const DEFAULT_SORT_DIR: SortDir = "asc";

export type SortableInventoryRow = {
  vin: string;
  make: string;
  year: number;
  advertised_price_cargurus: number | null;
  totalCost: number | null;
  profitLoss: number | null;
  purchase_date: string | null;
};

/**
 * Pure comparator — extracted so sort behavior (including null handling and
 * direction) can be unit tested without rendering the component.
 * Date fields are ISO "YYYY-MM-DD" strings, so lexicographic comparison is
 * equivalent to chronological comparison (see matchesInventoryFilters above).
 */
export function compareInventoryRows(
  a: SortableInventoryRow,
  b: SortableInventoryRow,
  sortKey: SortKey,
  sortDir: SortDir
): number {
  let av: string | number | null = null;
  let bv: string | number | null = null;
  if (sortKey === "vin")                       { av = a.vin;                       bv = b.vin; }
  if (sortKey === "make")                      { av = a.make;                      bv = b.make; }
  if (sortKey === "year")                      { av = a.year;                      bv = b.year; }
  if (sortKey === "advertised_price_cargurus")  { av = a.advertised_price_cargurus; bv = b.advertised_price_cargurus; }
  if (sortKey === "total_cost")                { av = a.totalCost;                 bv = b.totalCost; }
  if (sortKey === "profit_loss")                { av = a.profitLoss;                bv = b.profitLoss; }
  if (sortKey === "purchase_date")             { av = a.purchase_date;             bv = b.purchase_date; }
  if (av === null) return sortDir === "asc" ? 1 : -1;
  if (bv === null) return sortDir === "asc" ? -1 : 1;
  if (av < bv) return sortDir === "asc" ? -1 : 1;
  if (av > bv) return sortDir === "asc" ? 1 : -1;
  return 0;
}

export type InventoryFilters = {
  /** Unified free-text query — matched against VIN, make, model, and trim. */
  query: string;
  status: string;
  ownership: string;
  photography: string;
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
  purchaseDateFrom: string;
  purchaseDateTo: string;
  saleDateFrom: string;
  saleDateTo: string;
};

export const EMPTY_INVENTORY_FILTERS: InventoryFilters = {
  query: "", status: "", ownership: "", photography: "",
  minPrice: "", maxPrice: "", minYear: "", maxYear: "",
  purchaseDateFrom: "", purchaseDateTo: "", saleDateFrom: "", saleDateTo: "",
};

/** Sentinel `status` value meaning "any status except sold" — the default inventory view. */
export const STATUS_NOT_SOLD = "__not_sold__";

/**
 * Pure filter predicate — extracted so it can be unit tested without a DOM.
 * Date fields (purchase_date/sale_date) are ISO "YYYY-MM-DD" strings, so
 * lexicographic comparison is equivalent to chronological comparison.
 */
export function matchesInventoryFilters(v: VehicleListItem, f: InventoryFilters): boolean {
  if (f.query) {
    const q = f.query.trim().toLowerCase();
    const haystack = `${v.vin} ${v.make} ${v.model} ${v.trim ?? ""}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (f.status === STATUS_NOT_SOLD) { if (v.status === "sold") return false; }
  else if (f.status               && v.status !== f.status)                         return false;
  if (f.ownership    && v.ownership_status !== f.ownership)                          return false;
  if (f.photography  && v.photography_status !== f.photography)                      return false;
  if (f.minPrice     && (v.advertised_price_cargurus ?? 0) < parseFloat(f.minPrice))  return false;
  if (f.maxPrice     && (v.advertised_price_cargurus ?? 0) > parseFloat(f.maxPrice))  return false;
  if (f.minYear      && v.year < parseInt(f.minYear, 10))                            return false;
  if (f.maxYear      && v.year > parseInt(f.maxYear, 10))                            return false;
  if (f.purchaseDateFrom && (!v.purchase_date || v.purchase_date < f.purchaseDateFrom)) return false;
  if (f.purchaseDateTo   && (!v.purchase_date || v.purchase_date > f.purchaseDateTo))   return false;
  if (f.saleDateFrom     && (!v.sale_date || v.sale_date < f.saleDateFrom))             return false;
  if (f.saleDateTo       && (!v.sale_date || v.sale_date > f.saleDateTo))               return false;
  return true;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number | null, prefix = "$") {
  if (n === null) return "—";
  return `${prefix}${Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function fmtStatus(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_COLORS: Record<string, string> = {
  frontline_ready: "#1a7f4b",
  in_deal: "#f59e0b",
  sold: "#6b7280",
  on_lot_work_needed: "#b92111",
  pending_delivery: "#3b82f6",
  pending_pickup: "#3b82f6",
  bodyshop: "#7c3aed",
  mechanic_ssc: "#7c3aed",
  detailing_shop: "#0891b2",
  mechanic_repairs: "#7c3aed",
  openlane_arbitration: "#ea580c",
  sale_cancelled_by_arbitration: "#dc2626",
  openlane_auction: "#ea580c",
};

const OWNERSHIP_LABELS: Record<string, string> = {
  available: "Available",
  en_route: "En Route",
  not_received: "Not Received",
};

const PHOTO_LABELS: Record<string, string> = {
  pending: "Pending",
  done: "Done",
  na: "N/A",
};

const ALL_STATUSES = [
  "frontline_ready", "in_deal", "sold", "on_lot_work_needed",
  "pending_delivery", "pending_pickup", "bodyshop", "mechanic_ssc",
  "detailing_shop", "mechanic_repairs", "openlane_arbitration",
  "sale_cancelled_by_arbitration", "openlane_auction",
] as const;

const PAGE_SIZE = 10;

// ── Computed row ──────────────────────────────────────────────────────────────

function computeRow(v: VehicleListItem) {
  const totalCost  = calcTotalCost(v.purchase_price, v.expense_total);
  const profitLoss = calcProfitLoss(v.sale_price, totalCost);
  const commission = calcCommission(profitLoss, v.commission_percentage);
  return { ...v, totalCost, profitLoss, commission };
}

type InventoryRow = ReturnType<typeof computeRow>;

export const INVENTORY_EXPORT_COLUMNS: CSVColumn<InventoryRow>[] = [
  { key: "vin", label: "VIN", value: (r) => r.vin },
  { key: "make", label: "Make", value: (r) => r.make },
  { key: "model", label: "Model", value: (r) => r.model },
  { key: "year", label: "Year", value: (r) => r.year },
  { key: "trim", label: "Trim", value: (r) => r.trim },
  { key: "status", label: "Status", value: (r) => (r.status ? fmtStatus(r.status) : null) },
  { key: "ownership", label: "Ownership", value: (r) => (r.ownership_status ? OWNERSHIP_LABELS[r.ownership_status] ?? r.ownership_status : null) },
  { key: "photography", label: "Photography", value: (r) => (r.photography_status ? PHOTO_LABELS[r.photography_status] ?? r.photography_status : null) },
  { key: "purchase_date", label: "Purchase Date", value: (r) => r.purchase_date },
  { key: "sale_date", label: "Sale Date", value: (r) => r.sale_date },
  { key: "listed_price_cargurus", label: "Listed Price (CarGurus)", value: (r) => r.advertised_price_cargurus },
  { key: "listed_price_facebook", label: "Listed Price (Facebook)", value: (r) => r.advertised_price_facebook },
  { key: "purchase_price", label: "Purchase Price", value: (r) => r.purchase_price },
  { key: "expense_total", label: "Expense Total", value: (r) => r.expense_total },
  { key: "total_cost", label: "Total Cost", value: (r) => r.totalCost },
  { key: "sale_price", label: "Sale Price", value: (r) => r.sale_price },
  { key: "profit_loss", label: "Profit / Loss", value: (r) => r.profitLoss },
  { key: "commission", label: "Commission", value: (r) => r.commission },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function InventoryTable({ vehicles }: { vehicles: VehicleListItem[] }) {
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT_KEY);
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_SORT_DIR);
  const [page,    setPage]    = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [refreshingCache, setRefreshingCache] = useState(false);

  // Filters — defaults to hiding sold vehicles; "All Statuses" or "Sold" opt back in.
  const [filterQuery,       setFilterQuery]       = useState<string>("");
  const [filterStatus,      setFilterStatus]      = useState<string>(STATUS_NOT_SOLD);
  const [filterOwnership,   setFilterOwnership]   = useState<string>("");
  const [filterPhotography, setFilterPhotography] = useState<string>("");
  const [filterMinPrice,    setFilterMinPrice]    = useState<string>("");
  const [filterMaxPrice,    setFilterMaxPrice]    = useState<string>("");
  const [filterMinYear,     setFilterMinYear]     = useState<string>("");
  const [filterMaxYear,     setFilterMaxYear]     = useState<string>("");
  const [filterPurchaseFrom, setFilterPurchaseFrom] = useState<string>("");
  const [filterPurchaseTo,   setFilterPurchaseTo]   = useState<string>("");
  const [filterSaleFrom,     setFilterSaleFrom]     = useState<string>("");
  const [filterSaleTo,       setFilterSaleTo]       = useState<string>("");

  const rows = useMemo(() => vehicles.map(computeRow), [vehicles]);

  const filters: InventoryFilters = {
    query: filterQuery,
    status: filterStatus, ownership: filterOwnership, photography: filterPhotography,
    minPrice: filterMinPrice, maxPrice: filterMaxPrice, minYear: filterMinYear, maxYear: filterMaxYear,
    purchaseDateFrom: filterPurchaseFrom, purchaseDateTo: filterPurchaseTo,
    saleDateFrom: filterSaleFrom, saleDateTo: filterSaleTo,
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => matchesInventoryFilters(r, filters));
  }, [rows, filterQuery, filterStatus, filterOwnership, filterPhotography, filterMinPrice, filterMaxPrice, filterMinYear, filterMaxYear, filterPurchaseFrom, filterPurchaseTo, filterSaleFrom, filterSaleTo]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => compareInventoryRows(a, b, sortKey, sortDir));
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else setSortDir("asc");
      return key;
    });
    setPage(1);
  }, []);

  function sortArrow(key: SortKey) {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  function clearFilters() {
    setFilterQuery("");
    setFilterStatus(STATUS_NOT_SOLD); setFilterOwnership(""); setFilterPhotography("");
    setFilterMinPrice(""); setFilterMaxPrice(""); setFilterMinYear(""); setFilterMaxYear("");
    setFilterPurchaseFrom(""); setFilterPurchaseTo(""); setFilterSaleFrom(""); setFilterSaleTo("");
    setPage(1);
  }

  async function handleDelete(vin: string) {
    if (!confirm(`Delete vehicle ${vin}? This cannot be undone.`)) return;
    setDeleting(vin);
    try {
      const res = await fetch(`/api/vehicles/${vin}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setToast({ msg: `Vehicle ${vin} deleted.`, ok: true });
        setTimeout(() => window.location.reload(), 800);
      } else {
        const body = await res.json().catch(() => ({}));
        setToast({ msg: (body as { error?: string }).error ?? "Delete failed", ok: false });
      }
    } catch {
      setToast({ msg: "Network error", ok: false });
    } finally {
      setDeleting(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  // Advanced filters live behind the "Filters" popover — counted separately from
  // the free-text query so the popover button can show how many are active.
  const advancedFilterCount = [
    filterStatus !== STATUS_NOT_SOLD,
    Boolean(filterOwnership), Boolean(filterPhotography),
    Boolean(filterMinPrice), Boolean(filterMaxPrice), Boolean(filterMinYear), Boolean(filterMaxYear),
    Boolean(filterPurchaseFrom), Boolean(filterPurchaseTo), Boolean(filterSaleFrom), Boolean(filterSaleTo),
  ].filter(Boolean).length;

  const hasFilters = Boolean(filterQuery) || advancedFilterCount > 0;

  function handleExportCSV() {
    const csv = toCSV(sorted, INVENTORY_EXPORT_COLUMNS);
    downloadCSV(`inventory-export-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  async function handleRefreshCache() {
    setRefreshingCache(true);
    try {
      const res = await fetch("/api/admin/refresh-cache", { method: "POST" });
      if (res.ok) {
        setToast({ msg: "Public site cache refreshed.", ok: true });
      } else {
        const body = await res.json().catch(() => ({}));
        setToast({ msg: (body as { error?: string }).error ?? "Cache refresh failed", ok: false });
      }
    } catch {
      setToast({ msg: "Network error", ok: false });
    } finally {
      setRefreshingCache(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <div className="inv-wrap">
      {toast && (
        <div className={`inv-toast ${toast.ok ? "inv-toast--ok" : "inv-toast--err"}`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="inv-header">
        <div>
          <h1 className="inv-title">Inventory</h1>
          <p className="inv-sub">{filtered.length} vehicle{filtered.length !== 1 ? "s" : ""}{hasFilters ? " (filtered)" : ""}</p>
        </div>
        <div className="inv-header-actions">
          <button type="button" className="btn btn--ghost" onClick={handleExportCSV} disabled={sorted.length === 0}>
            Export CSV
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleRefreshCache}
            disabled={refreshingCache}
            title="Purge the public site's vehicle-list cache so recent changes show up immediately"
          >
            {refreshingCache ? "Refreshing…" : "Refresh Public Cache"}
          </button>
          <a href="/admin/inventory/import" className="btn btn--ghost">CSV Import</a>
          <a href="/admin/inventory/new" className="btn btn--primary">+ Add Vehicle</a>
        </div>
      </div>

      {/* Search */}
      <AdminSearchBar
        value={filterQuery}
        onChange={(v) => { setFilterQuery(v); setPage(1); }}
        placeholder="Search VIN, make, or model…"
        filters={{
          activeCount: advancedFilterCount,
          onClear: hasFilters ? clearFilters : undefined,
          panel: (
            <div className="inv-filter-panel">
              <div className="inv-filter-row">
                <label className="inv-filter-field">
                  Status
                  <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
                    <option value={STATUS_NOT_SOLD}>All (Not Sold)</option>
                    <option value="">All Statuses</option>
                    {ALL_STATUSES.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
                  </select>
                </label>
                <label className="inv-filter-field">
                  Ownership
                  <select value={filterOwnership} onChange={(e) => { setFilterOwnership(e.target.value); setPage(1); }}>
                    <option value="">All Ownership</option>
                    {Object.entries(OWNERSHIP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                <label className="inv-filter-field">
                  Photography
                  <select value={filterPhotography} onChange={(e) => { setFilterPhotography(e.target.value); setPage(1); }}>
                    <option value="">All Photography</option>
                    {Object.entries(PHOTO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
              </div>
              <div className="inv-filter-row">
                <label className="inv-filter-field">
                  Price
                  <span className="inv-filter-range">
                    <input type="number" placeholder="Min" value={filterMinPrice} onChange={(e) => { setFilterMinPrice(e.target.value); setPage(1); }} />
                    <span>–</span>
                    <input type="number" placeholder="Max" value={filterMaxPrice} onChange={(e) => { setFilterMaxPrice(e.target.value); setPage(1); }} />
                  </span>
                </label>
                <label className="inv-filter-field">
                  Year
                  <span className="inv-filter-range">
                    <input type="number" placeholder="Min" value={filterMinYear} onChange={(e) => { setFilterMinYear(e.target.value); setPage(1); }} />
                    <span>–</span>
                    <input type="number" placeholder="Max" value={filterMaxYear} onChange={(e) => { setFilterMaxYear(e.target.value); setPage(1); }} />
                  </span>
                </label>
              </div>
              <div className="inv-filter-row">
                <label className="inv-filter-field">
                  Purchased
                  <span className="inv-filter-range">
                    <input type="date" value={filterPurchaseFrom} onChange={(e) => { setFilterPurchaseFrom(e.target.value); setPage(1); }} />
                    <span>to</span>
                    <input type="date" value={filterPurchaseTo} onChange={(e) => { setFilterPurchaseTo(e.target.value); setPage(1); }} />
                  </span>
                </label>
                <label className="inv-filter-field">
                  Sold
                  <span className="inv-filter-range">
                    <input type="date" value={filterSaleFrom} onChange={(e) => { setFilterSaleFrom(e.target.value); setPage(1); }} />
                    <span>to</span>
                    <input type="date" value={filterSaleTo} onChange={(e) => { setFilterSaleTo(e.target.value); setPage(1); }} />
                  </span>
                </label>
              </div>
            </div>
          ),
        }}
      />

      {/* Table */}
      <div className="inv-table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort("vin")}        className="sortable">VIN{sortArrow("vin")}</th>
              <th onClick={() => toggleSort("make")}       className="sortable">Make / Model{sortArrow("make")}</th>
              <th onClick={() => toggleSort("year")}       className="sortable">Year{sortArrow("year")}</th>
              <th>Status</th>
              <th>Ownership</th>
              <th>Photos</th>
              <th onClick={() => toggleSort("purchase_date")} className="sortable">Purchased{sortArrow("purchase_date")}</th>
              <th>Sold</th>
              <th onClick={() => toggleSort("advertised_price_cargurus")} className="sortable">Listed Price{sortArrow("advertised_price_cargurus")}</th>
              <th onClick={() => toggleSort("total_cost")}       className="sortable">Total Cost{sortArrow("total_cost")}</th>
              <th onClick={() => toggleSort("profit_loss")}      className="sortable">P/L{sortArrow("profit_loss")}</th>
              <th>Commission</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr><td colSpan={13} className="inv-empty">No vehicles match the current filters.</td></tr>
            )}
            {paginated.map((v) => {
              const plColor = v.profitLoss === null ? "#6b7280" : v.profitLoss >= 0 ? "#1a7f4b" : "#b92111";
              return (
                <tr key={v.vin}>
                  <td>
                    <a href={`/admin/inventory/${v.vin}`} className="vin-link">
                      <code>{v.vin}</code>
                    </a>
                  </td>
                  <td>
                    <div className="make-cell">
                      <strong>{v.make} {v.model}</strong>
                      {v.trim && <span className="trim">{v.trim}</span>}
                    </div>
                  </td>
                  <td>{v.year}</td>
                  <td>
                    <div className="badges">
                      {v.status
                        ? <span className="badge" style={{ background: `${STATUS_COLORS[v.status] ?? "#6b7280"}22`, color: STATUS_COLORS[v.status] ?? "#6b7280" }}>{fmtStatus(v.status)}</span>
                        : <span className="badge badge--gray">—</span>
                      }
                    </div>
                  </td>
                  <td><span className="dim">{v.ownership_status ? OWNERSHIP_LABELS[v.ownership_status] ?? v.ownership_status : "—"}</span></td>
                  <td><span className="dim">{v.photography_status ? PHOTO_LABELS[v.photography_status] ?? v.photography_status : "—"}</span></td>
                  <td><span className="dim">{fmtDate(v.purchase_date)}</span></td>
                  <td><span className="dim">{fmtDate(v.sale_date)}</span></td>
                  <td className="num">
                    <div>{v.advertised_price_cargurus != null ? <><span style={{fontSize:10,color:"#99a1b2",fontWeight:600}}>CG </span>{fmt(v.advertised_price_cargurus)}</> : "—"}</div>
                    {v.advertised_price_facebook != null && <div style={{fontSize:12,color:"#64748b"}}><span style={{fontSize:10,color:"#99a1b2",fontWeight:600}}>FB </span>{fmt(v.advertised_price_facebook)}</div>}
                  </td>
                  <td className="num">{fmt(v.totalCost)}</td>
                  <td className="num" style={{ color: plColor, fontWeight: 600 }}>
                    {v.profitLoss === null ? "—" : `${v.profitLoss < 0 ? "-" : ""}${fmt(v.profitLoss)}`}
                  </td>
                  <td className="num">{fmt(v.commission)}</td>
                  <td>
                    <div className="row-actions">
                      <a href={`/admin/inventory/${v.vin}`} className="btn-sm btn-sm--edit">Edit</a>
                      <button
                        type="button"
                        className="btn-sm btn-sm--delete"
                        onClick={() => handleDelete(v.vin)}
                        disabled={deleting === v.vin}
                      >
                        {deleting === v.vin ? "…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="inv-pagination">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className={n === page ? "active" : ""} onClick={() => setPage(n)}>{n}</button>
          ))}
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
        </nav>
      )}

      <style>{`
        .inv-wrap { font-family: 'Inter', sans-serif; }
        .inv-toast {
          position: fixed; top: 20px; right: 20px; z-index: 9999;
          padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 500;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .inv-toast--ok  { background: #ecfdf5; color: #1a7f4b; border: 1px solid #86efac; }
        .inv-toast--err { background: #fef2f1; color: #b92111; border: 1px solid #fca5a5; }

        .inv-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
        .inv-title  { font-size: 24px; font-weight: 800; color: #1a1d23; }
        .inv-sub    { font-size: 13px; color: #99a1b2; margin-top: 3px; }
        .inv-header-actions { display: flex; gap: 8px; }

        .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; }
        .btn--primary { background: #b92111; color: #fff; }
        .btn--primary:hover { background: #9e1c0e; }
        .btn--ghost { background: #fff; color: #1a1d23; border: 1px solid #e4e7ec; }
        .btn--ghost:hover { background: #f8f9fb; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn:disabled:hover { background: #fff; }

        .inv-filter-panel { display: flex; flex-direction: column; gap: 14px; }
        .inv-filter-row { display: flex; flex-wrap: wrap; gap: 14px; }
        .inv-filter-field {
          display: flex; flex-direction: column; gap: 5px;
          font-size: 12px; font-weight: 600; color: #344054;
        }
        .inv-filter-field select, .inv-filter-field input {
          height: 34px; padding: 0 10px; border: 1px solid #e4e7ec; border-radius: 6px;
          font-size: 13px; font-weight: 400; color: #1a1d23; background: #f8f9fb;
        }
        .inv-filter-field select { min-width: 160px; }
        .inv-filter-field input { width: 100px; }
        .inv-filter-field input[type="date"] { width: 132px; }
        .inv-filter-range { display: flex; align-items: center; gap: 6px; font-weight: 400; color: #99a1b2; }

        .inv-table-wrap { background: #fff; border: 1px solid #e4e7ec; border-radius: 8px; overflow: auto; }
        .inv-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .inv-table th {
          padding: 10px 14px; font-size: 11px; font-weight: 700; color: #99a1b2;
          text-transform: uppercase; letter-spacing: 0.05em;
          border-bottom: 1px solid #e4e7ec; white-space: nowrap; text-align: left;
        }
        .inv-table th.sortable { cursor: pointer; user-select: none; }
        .inv-table th.sortable:hover { color: #1a1d23; }
        .inv-table td { padding: 11px 14px; border-bottom: 1px solid #f0f2f5; vertical-align: middle; }
        .inv-table tr:last-child td { border-bottom: none; }
        .inv-table tr:hover td { background: #f7f9fd; }
        .inv-empty { text-align: center; color: #99a1b2; padding: 32px; }

        .vin-link code { font-size: 12px; color: #b92111; font-family: monospace; }
        .vin-link:hover code { text-decoration: underline; }
        .make-cell strong { display: block; font-weight: 600; color: #1a1d23; }
        .make-cell .trim  { display: block; font-size: 12px; color: #99a1b2; margin-top: 1px; }
        .dim  { color: #6b7280; font-size: 12px; }
        .num  { font-variant-numeric: tabular-nums; }

        .badges { display: flex; flex-wrap: wrap; gap: 4px; }
        .badge { display: inline-block; padding: 2px 7px; border-radius: 100px; font-size: 11px; font-weight: 600; white-space: nowrap; }
        .badge--gray { background: #f3f4f6; color: #6b7280; }

        .row-actions { display: flex; gap: 6px; white-space: nowrap; }
        .btn-sm { padding: 4px 10px; border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; }
        .btn-sm--edit   { background: #f0f2f5; color: #1a1d23; }
        .btn-sm--edit:hover { background: #e4e7ec; }
        .btn-sm--delete { background: #fef2f1; color: #b92111; }
        .btn-sm--delete:hover { background: #fee2e2; }
        .btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }

        .inv-pagination { display: flex; justify-content: center; gap: 4px; margin-top: 16px; }
        .inv-pagination button {
          width: 32px; height: 32px; border: 1px solid #e4e7ec; border-radius: 6px;
          background: #fff; font-size: 13px; cursor: pointer; font-weight: 500;
        }
        .inv-pagination button:hover:not(:disabled) { background: #f8f9fb; }
        .inv-pagination button.active { background: #b92111; color: #fff; border-color: #b92111; }
        .inv-pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
