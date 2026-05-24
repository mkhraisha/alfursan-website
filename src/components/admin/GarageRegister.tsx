import { useState } from "react";

type GarageVehicle = {
  vin: string;
  make: string;
  body_type: string | null;
  colour: string | null;
  odometer: number | null;
  purchased_from_name: string | null;
  purchased_from_address: string | null;
  purchase_date: string | null;
  purchaser_name: string | null;
  purchaser_address: string | null;
  sale_date: string | null;
};

type Props = {
  vehicles: GarageVehicle[];
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function GarageRegister({ vehicles: initial }: Props) {
  const [vehicles] = useState<GarageVehicle[]>(initial);
  const [search, setSearch] = useState("");

  const q = search.toLowerCase();
  const filtered = vehicles.filter((v) =>
    !search ||
    v.vin.toLowerCase().includes(q) ||
    v.make.toLowerCase().includes(q) ||
    (v.purchased_from_name ?? "").toLowerCase().includes(q) ||
    (v.purchaser_name ?? "").toLowerCase().includes(q)
  );

  return (
    <div>
      <style>{`
        .gr-header { margin-bottom: 20px; }
        .gr-header h1 { font-size: 24px; font-weight: 800; color: #1a1d23; }
        .gr-header p { color: #99a1b2; font-size: 14px; margin-top: 4px; }

        .gr-toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
        .gr-search {
          flex: 1; min-width: 200px; max-width: 360px;
          padding: 9px 12px; border: 1px solid #e4e7ec; border-radius: 6px;
          font-size: 14px; font-family: inherit; color: #1a1d23; background: #fff;
        }
        .gr-search:focus { outline: 2px solid #B92111; border-color: transparent; }
        .gr-count { color: #99a1b2; font-size: 13px; margin-left: auto; }

        .gr-section { background: #fff; border: 1px solid #e4e7ec; border-radius: 10px; overflow: hidden; }
        .gr-wrap { overflow-x: auto; }
        .gr-empty { padding: 40px; text-align: center; color: #99a1b2; font-size: 14px; }

        .gr-table { width: 100%; border-collapse: collapse; font-size: 13px; }

        /* Section group header row */
        .gr-table th.gr-group {
          padding: 7px 14px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          border-bottom: 1px solid #e4e7ec;
          white-space: nowrap;
        }
        .gr-group--from   { background: #eff6ff; color: #1d4ed8; border-right: 2px solid #bfdbfe; }
        .gr-group--vehicle { background: #f0fdf4; color: #15803d; border-right: 2px solid #bbf7d0; }
        .gr-group--to     { background: #fdf4ff; color: #7e22ce; }
        .gr-group--id     { background: #f8f9fb; color: #64748b; border-right: 1px solid #e4e7ec; }

        /* Column header row */
        .gr-table th.gr-col {
          padding: 8px 14px;
          font-size: 10px;
          font-weight: 700;
          color: #99a1b2;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 2px solid #e4e7ec;
          white-space: nowrap;
          background: #fafbfc;
        }
        .gr-col--from-border { border-right: 2px solid #bfdbfe; }
        .gr-col--vehicle-border { border-right: 2px solid #bbf7d0; }

        /* Data cells */
        .gr-table td {
          padding: 10px 14px;
          border-bottom: 1px solid #f0f2f5;
          color: #1a1d23;
          vertical-align: middle;
        }
        .gr-table tr:last-child td { border-bottom: none; }
        .gr-table tr:hover td { background: #f8f9fb; }
        .gr-td--from-border { border-right: 2px solid #dbeafe; }
        .gr-td--vehicle-border { border-right: 2px solid #dcfce7; }

        .gr-reg { font-weight: 700; font-size: 14px; font-family: monospace; color: #1a1d23; }
        .gr-reg--empty { color: #c4cad4; font-weight: 400; font-style: italic; font-size: 12px; font-family: inherit; }
        .gr-vin { font-family: monospace; font-size: 11px; }
        .gr-vin-link { text-decoration: none; color: #3b82f6; }
        .gr-vin-link:hover { text-decoration: underline; }

        .gr-muted { color: #99a1b2; font-size: 12px; }
        .gr-purpose { color: #64748b; font-size: 12px; font-style: italic; }
        .gr-instock { color: #1a7f4b; font-weight: 600; font-size: 12px; }

        .gr-inline { display: flex; gap: 6px; align-items: center; }
        .gr-inline-input {
          padding: 5px 8px; border: 1px solid #e4e7ec; border-radius: 4px;
          font-size: 13px; font-family: monospace; width: 110px;
        }
        .gr-inline-input:focus { outline: 2px solid #B92111; border-color: transparent; }
        .gr-btn-sm {
          padding: 3px 9px; border-radius: 4px; font-size: 12px; font-weight: 600;
          font-family: inherit; cursor: pointer; border: none; white-space: nowrap;
        }
        .gr-btn-sm--save { background: #1a7f4b; color: #fff; }
        .gr-btn-sm--save:hover:not(:disabled) { opacity: 0.85; }
        .gr-btn-sm--cancel { background: transparent; border: 1px solid #e4e7ec; color: #64748b; }
        .gr-btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
        .gr-edit-link {
          background: none; border: none; padding: 0;
          cursor: pointer; font-size: 11px; font-weight: 500;
          font-family: inherit; color: #3b82f6;
        }
        .gr-edit-link:hover { text-decoration: underline; }

        .gr-toasts {
          position: fixed; bottom: 24px; right: 24px;
          display: flex; flex-direction: column; gap: 8px; z-index: 9999;
        }
        .gr-toast { padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; animation: grSlide 0.2s ease; }
        .gr-toast--ok { background: #d1fae5; color: #065f46; }
        .gr-toast--err { background: #fee2e2; color: #7f1d1d; }
        @keyframes grSlide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      `}</style>

      <div className="gr-header">
        <h1>Garage Register</h1>
        <p>Ontario dealer vehicle intake and outflow log, sorted by acquisition date.</p>
      </div>

      <div className="gr-toolbar">
        <input
          type="search"
          className="gr-search"
          placeholder="Search VIN, make, name, or register #…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="gr-count">{filtered.length} {filtered.length === 1 ? "vehicle" : "vehicles"}</span>
      </div>

      <div className="gr-section">
        <div className="gr-wrap">
          {filtered.length === 0 ? (
            <div className="gr-empty">No vehicles found.</div>
          ) : (
            <table className="gr-table">
              <thead>
                {/* ── Section group headers ── */}
                <tr>
                  <th className="gr-group gr-group--from" colSpan={4}>Purchased From — Registered Owner</th>
                  <th className="gr-group gr-group--vehicle" colSpan={5}>Used Motor Vehicle</th>
                  <th className="gr-group gr-group--to" colSpan={3}>Sold To — New Owner</th>
                </tr>
                {/* ── Column headers ── */}
                <tr>
                  {/* Purchased From */}
                  <th className="gr-col">Name</th>
                  <th className="gr-col">Address</th>
                  <th className="gr-col">Date Acquired</th>
                  <th className="gr-col gr-col--from-border">Purpose</th>
                  {/* Motor Vehicle */}
                  <th className="gr-col">VIN</th>
                  <th className="gr-col">Make</th>
                  <th className="gr-col">Style</th>
                  <th className="gr-col">Colour</th>
                  <th className="gr-col gr-col--vehicle-border">Odometer (km)</th>
                  {/* Sold To */}
                  <th className="gr-col">Name</th>
                  <th className="gr-col">Address</th>
                  <th className="gr-col">Date Sold</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                    <tr key={v.vin}>
                      {/* ── Purchased From ── */}
                      <td>{v.purchased_from_name ?? <span className="gr-muted">—</span>}</td>
                      <td style={{ maxWidth: 200, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {v.purchased_from_address ?? <span className="gr-muted">—</span>}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtDate(v.purchase_date)}</td>
                      <td className="gr-purpose gr-td--from-border">Resale</td>

                      {/* ── Motor Vehicle ── */}
                      <td>
                        <a href={`/admin/inventory/${v.vin}`} className="gr-vin gr-vin-link">{v.vin}</a>
                      </td>
                      <td>{v.make}</td>
                      <td>{v.body_type ?? <span className="gr-muted">—</span>}</td>
                      <td>{v.colour ?? <span className="gr-muted">—</span>}</td>
                      <td className="gr-td--vehicle-border" style={{ whiteSpace: "nowrap" }}>
                        {v.odometer != null ? `${v.odometer.toLocaleString("en-CA")} km` : <span className="gr-muted">—</span>}
                      </td>

                      {/* ── Sold To ── */}
                      <td>{v.purchaser_name ?? <span className="gr-muted">—</span>}</td>
                      <td style={{ maxWidth: 200, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {v.purchaser_address ?? <span className="gr-muted">—</span>}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {v.sale_date
                          ? fmtDate(v.sale_date)
                          : <span className="gr-instock">In Stock</span>
                        }
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
