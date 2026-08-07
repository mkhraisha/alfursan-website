import { useEffect, useRef, useState } from "react";

/**
 * Shared unified search bar for admin list views (Inventory, Garage Register,
 * Expenses, …). One prominent free-text input up front; anything that can't
 * be expressed as plain text (price/year/date ranges, status dropdowns, …)
 * lives behind an optional "Filters" popover so the toolbar stays a single
 * row regardless of how many advanced fields a given view needs.
 */
export type AdminSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Advanced filters, rendered in a popover anchored to a "Filters" button. */
  filters?: {
    /** Number of advanced filters currently active — shown as a badge. */
    activeCount: number;
    /** Content of the popover (selects, ranges, date pickers, …). */
    panel: React.ReactNode;
    /** Clears every advanced filter (and, typically, the search text too). */
    onClear?: () => void;
  };
  /** e.g. "42 vehicles" — rendered right-aligned in the bar. */
  resultsLabel?: string;
  /** Right-aligned action buttons/links (Export CSV, + Add, …). */
  actions?: React.ReactNode;
};

export default function AdminSearchBar({
  value,
  onChange,
  placeholder = "Search…",
  filters,
  resultsLabel,
  actions,
}: AdminSearchBarProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <div className="asb-wrap" ref={rootRef}>
      <div className="asb-bar">
        <div className="asb-search">
          <svg viewBox="0 0 20 20" fill="none" className="asb-search-icon" aria-hidden="true">
            <path d="M9 15.5A6.5 6.5 0 1 0 9 2.5a6.5 6.5 0 0 0 0 13Zm8.5 2-3.6-3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            className="asb-input"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>

        {filters && (
          <div className="asb-filters-anchor">
            <button
              type="button"
              className={`asb-filters-btn ${filters.activeCount > 0 ? "asb-filters-btn--active" : ""}`}
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
            >
              Filters
              {filters.activeCount > 0 && <span className="asb-badge">{filters.activeCount}</span>}
            </button>
            {open && (
              <div className="asb-popover">
                {filters.panel}
              </div>
            )}
          </div>
        )}

        {(value || (filters && filters.activeCount > 0)) && filters?.onClear && (
          <button type="button" className="asb-clear" onClick={filters.onClear}>Clear</button>
        )}

        {resultsLabel && <span className="asb-count">{resultsLabel}</span>}
        {actions && <div className="asb-actions">{actions}</div>}
      </div>

      <style>{`
        .asb-wrap { position: relative; margin-bottom: 16px; }
        .asb-bar {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          padding: 10px 12px; background: #fff; border: 1px solid #e4e7ec; border-radius: 8px;
        }

        .asb-search {
          position: relative; flex: 1 1 260px; min-width: 200px; max-width: 420px;
        }
        .asb-search-icon {
          position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
          width: 15px; height: 15px; color: #99a1b2; pointer-events: none;
        }
        .asb-input {
          width: 100%; height: 36px; padding: 0 12px 0 32px;
          border: 1px solid #e4e7ec; border-radius: 6px; background: #f8f9fb;
          font-size: 14px; font-family: inherit; color: #1a1d23;
        }
        .asb-input:focus { outline: 2px solid #B92111; outline-offset: -1px; border-color: transparent; background: #fff; }
        .asb-input::-webkit-search-cancel-button { cursor: pointer; }

        .asb-filters-anchor { position: relative; }
        .asb-filters-btn {
          display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px;
          border: 1px solid #e4e7ec; border-radius: 6px; background: #fff; color: #1a1d23;
          font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer;
        }
        .asb-filters-btn:hover { background: #f8f9fb; }
        .asb-filters-btn--active { border-color: #B92111; color: #B92111; }
        .asb-badge {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 18px; height: 18px; padding: 0 5px; border-radius: 100px;
          background: #B92111; color: #fff; font-size: 11px; font-weight: 700;
        }

        .asb-popover {
          position: absolute; top: calc(100% + 8px); left: 0; z-index: 20;
          min-width: 420px; max-width: 92vw;
          background: #fff; border: 1px solid #e4e7ec; border-radius: 10px;
          box-shadow: 0 12px 32px rgba(20, 20, 20, 0.14);
          padding: 16px;
        }

        .asb-clear {
          height: 36px; padding: 0 12px; border: none; background: none;
          color: #6b7280; font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer;
        }
        .asb-clear:hover { color: #B92111; }

        .asb-count { color: #99a1b2; font-size: 13px; margin-left: auto; white-space: nowrap; }
        .asb-actions { display: flex; gap: 8px; }
      `}</style>
    </div>
  );
}
