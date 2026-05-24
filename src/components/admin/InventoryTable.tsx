import { useState, useMemo, useCallback } from "react";
import { calcTotalCost, calcProfitLoss, calcCommission } from "../../lib/vehicles";

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
  purchase_price: number | null;
  sale_price: number | null;
  expense_total: number;
  commission_percentage: number | null;
};

type SortKey = "vin" | "make" | "year" | "advertised_price_cargurus" | "total_cost" | "profit_loss";
type SortDir = "asc" | "desc";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number | null, prefix = "$") {
  if (n === null) return "—";
  return `${prefix}${Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
  const profitLoss = calcProfitLoss(v.sale_price, v.advertised_price_cargurus, totalCost);
  const commission = calcCommission(profitLoss, v.commission_percentage);
  return { ...v, totalCost, profitLoss, commission };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InventoryTable({ vehicles }: { vehicles: VehicleListItem[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("vin");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page,    setPage]    = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  // Filters
  const [filterStatus,      setFilterStatus]      = useState<string>("");
  const [filterOwnership,   setFilterOwnership]   = useState<string>("");
  const [filterPhotography, setFilterPhotography] = useState<string>("");
  const [filterMinPrice,    setFilterMinPrice]    = useState<string>("");
  const [filterMaxPrice,    setFilterMaxPrice]    = useState<string>("");
  const [filterMinYear,     setFilterMinYear]     = useState<string>("");
  const [filterMaxYear,     setFilterMaxYear]     = useState<string>("");

  const rows = useMemo(() => vehicles.map(computeRow), [vehicles]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterStatus      && r.status !== filterStatus)                                   return false;
      if (filterOwnership   && r.ownership_status   !== filterOwnership)                   return false;
      if (filterPhotography && r.photography_status !== filterPhotography)                  return false;
      if (filterMinPrice    && (r.advertised_price_cargurus ?? 0) < parseFloat(filterMinPrice))  return false;
      if (filterMaxPrice    && (r.advertised_price_cargurus ?? 0) > parseFloat(filterMaxPrice))  return false;
      if (filterMinYear     && r.year < parseInt(filterMinYear))                            return false;
      if (filterMaxYear     && r.year > parseInt(filterMaxYear))                            return false;
      return true;
    });
  }, [rows, filterStatus, filterOwnership, filterPhotography, filterMinPrice, filterMaxPrice, filterMinYear, filterMaxYear]);

  const sorted = useMemo(() => {
    const cmp = (a: typeof filtered[0], b: typeof filtered[0]) => {
      let av: string | number | null = null;
      let bv: string | number | null = null;
      if (sortKey === "vin")             { av = a.vin;             bv = b.vin; }
      if (sortKey === "make")            { av = a.make;            bv = b.make; }
      if (sortKey === "year")            { av = a.year;            bv = b.year; }
      if (sortKey === "advertised_price_cargurus"){ av = a.advertised_price_cargurus; bv = b.advertised_price_cargurus; }
      if (sortKey === "total_cost")      { av = a.totalCost;       bv = b.totalCost; }
      if (sortKey === "profit_loss")     { av = a.profitLoss;      bv = b.profitLoss; }
      if (av === null) return sortDir === "asc" ? 1 : -1;
      if (bv === null) return sortDir === "asc" ? -1 : 1;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    };
    return [...filtered].sort(cmp);
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
    setFilterStatus(""); setFilterOwnership(""); setFilterPhotography("");
    setFilterMinPrice(""); setFilterMaxPrice(""); setFilterMinYear(""); setFilterMaxYear("");
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

  const hasFilters = filterStatus || filterOwnership || filterPhotography || filterMinPrice || filterMaxPrice || filterMinYear || filterMaxYear;

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
          <a href="/admin/inventory/import" className="btn btn--ghost">CSV Import</a>
          <a href="/admin/inventory/new" className="btn btn--primary">+ Add Vehicle</a>
        </div>
      </div>

      {/* Filters */}
      <div className="inv-filters">
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
        </select>
        <select value={filterOwnership} onChange={(e) => { setFilterOwnership(e.target.value); setPage(1); }}>
          <option value="">All Ownership</option>
          {Object.entries(OWNERSHIP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterPhotography} onChange={(e) => { setFilterPhotography(e.target.value); setPage(1); }}>
          <option value="">All Photography</option>
          {Object.entries(PHOTO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="number" placeholder="Min Price" value={filterMinPrice} onChange={(e) => { setFilterMinPrice(e.target.value); setPage(1); }} />
        <input type="number" placeholder="Max Price" value={filterMaxPrice} onChange={(e) => { setFilterMaxPrice(e.target.value); setPage(1); }} />
        <input type="number" placeholder="Min Year"  value={filterMinYear}  onChange={(e) => { setFilterMinYear(e.target.value);  setPage(1); }} />
        <input type="number" placeholder="Max Year"  value={filterMaxYear}  onChange={(e) => { setFilterMaxYear(e.target.value);  setPage(1); }} />
        {hasFilters && <button type="button" className="btn btn--ghost" onClick={clearFilters}>Clear</button>}
      </div>

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
              <th onClick={() => toggleSort("advertised_price_cargurus")} className="sortable">Listed Price{sortArrow("advertised_price_cargurus")}</th>
              <th onClick={() => toggleSort("total_cost")}       className="sortable">Total Cost{sortArrow("total_cost")}</th>
              <th onClick={() => toggleSort("profit_loss")}      className="sortable">P/L{sortArrow("profit_loss")}</th>
              <th>Commission</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr><td colSpan={11} className="inv-empty">No vehicles match the current filters.</td></tr>
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

        .inv-filters {
          display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
          padding: 14px 16px; background: #fff; border: 1px solid #e4e7ec; border-radius: 8px;
        }
        .inv-filters select, .inv-filters input {
          height: 34px; padding: 0 10px; border: 1px solid #e4e7ec; border-radius: 6px;
          font-size: 13px; color: #1a1d23; background: #f8f9fb;
        }
        .inv-filters select { min-width: 140px; }
        .inv-filters input  { width: 110px; }

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
