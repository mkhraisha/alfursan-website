import { useEffect, useRef, useState } from "react";

/**
 * Unified search bar for public inventory views (Search, Sold). Mirrors the
 * admin dashboard's shared `AdminSearchBar` pattern: one prominent free-text
 * input up front, with anything that can't be expressed as plain text
 * (price/mileage ranges, body/drive/fuel type, …) tucked behind an optional
 * "Filters" popover so the toolbar stays a single row.
 */
export type PublicSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Advanced filters, rendered in a popover anchored to a "Filters" button. */
  filters?: {
    /** Number of advanced filters currently active — shown as a badge. */
    activeCount: number;
    /** Content of the popover (selects, ranges, …). */
    panel: React.ReactNode;
    /** Clears every advanced filter (and, typically, the search text too). */
    onClear?: () => void;
  };
  /** e.g. "42 Results" — rendered right-aligned in the bar. */
  resultsLabel?: string;
  /** Right-aligned action content (e.g. the sort control). */
  actions?: React.ReactNode;
};

export default function PublicSearchBar({
  value,
  onChange,
  placeholder = "Search…",
  filters,
  resultsLabel,
  actions,
}: PublicSearchBarProps) {
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
    <div className="psb-wrap" ref={rootRef}>
      <div className="psb-bar">
        <div className="psb-search">
          <svg viewBox="0 0 20 20" fill="none" className="psb-search-icon" aria-hidden="true">
            <path d="M9 15.5A6.5 6.5 0 1 0 9 2.5a6.5 6.5 0 0 0 0 13Zm8.5 2-3.6-3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            className="psb-input"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={placeholder}
          />
        </div>

        {filters && (
          <div className="psb-filters-anchor">
            <button
              type="button"
              className={`psb-filters-btn ${filters.activeCount > 0 ? "psb-filters-btn--active" : ""}`}
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
            >
              Filters
              {filters.activeCount > 0 && <span className="psb-badge">{filters.activeCount}</span>}
            </button>
            {open && <div className="psb-popover">{filters.panel}</div>}
          </div>
        )}

        {(value || (filters && filters.activeCount > 0)) && filters?.onClear && (
          <button type="button" className="psb-clear" onClick={filters.onClear}>
            Clear all
          </button>
        )}

        {resultsLabel && <span className="psb-count">{resultsLabel}</span>}
        {actions && <div className="psb-actions">{actions}</div>}
      </div>

      <style>{`
        .psb-wrap { position: relative; margin-bottom: 1rem; }
        .psb-bar {
          display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;
          padding: 0.85rem 1rem; background: var(--surface); border: 1px solid var(--line);
          border-radius: 10px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
        }

        .psb-search { position: relative; flex: 2 1 280px; min-width: 220px; }
        .psb-search-icon {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          width: 16px; height: 16px; color: var(--muted); pointer-events: none;
        }
        .psb-input {
          width: 100%; height: 44px; padding: 0 0.9rem 0 2.25rem;
          border: 1px solid var(--line); border-radius: 8px; background: var(--surface);
          font-size: 0.92rem; font-weight: 600; font-family: inherit; color: var(--ink);
        }
        .psb-input:hover { border-color: var(--brand-red); }
        .psb-input:focus { outline: none; border-color: var(--brand-red); }
        .psb-input::-webkit-search-cancel-button { cursor: pointer; }

        .psb-filters-anchor { position: relative; }
        .psb-filters-btn {
          display: inline-flex; align-items: center; gap: 6px; height: 44px; padding: 0 1rem;
          border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink);
          font-size: 0.9rem; font-weight: 700; font-family: inherit; cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .psb-filters-btn:hover { border-color: var(--brand-red); color: var(--brand-red); }
        .psb-filters-btn--active {
          border-color: var(--active-filter-border); color: var(--active-filter-text);
          background: var(--bg-active-filter);
        }
        .psb-badge {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 18px; height: 18px; padding: 0 5px; border-radius: 100px;
          background: var(--brand-red); color: #fff; font-size: 0.68rem; font-weight: 700;
        }

        .psb-popover {
          position: absolute; top: calc(100% + 8px); left: 0; z-index: 20;
          min-width: 420px; max-width: 92vw;
          background: var(--surface); border: 1px solid var(--line); border-radius: 10px;
          box-shadow: 0 12px 32px rgba(20, 20, 20, 0.14);
          padding: 1rem;
        }

        .psb-clear {
          height: 44px; padding: 0 0.6rem; border: none; background: none;
          color: var(--muted); font-size: 0.88rem; font-weight: 700; font-family: inherit; cursor: pointer;
          text-decoration: underline;
        }
        .psb-clear:hover { color: var(--brand-red); }

        .psb-count { color: var(--muted); font-size: 0.9rem; margin-left: auto; white-space: nowrap; }
        .psb-actions { display: flex; align-items: center; gap: 0.5rem; }

        @media (max-width: 700px) {
          .psb-bar { padding: 0.75rem; }
          .psb-search { flex: 1 1 100%; }
          .psb-count { margin-left: 0; order: 1; flex: 1 1 auto; }
          .psb-actions { order: 2; }
          .psb-popover { min-width: unset; width: 100%; left: 0; right: 0; }
        }
      `}</style>
    </div>
  );
}
