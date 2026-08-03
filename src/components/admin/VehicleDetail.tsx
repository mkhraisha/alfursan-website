import { useState, useCallback, useRef } from "react";
import { calcTotalCost, calcProfitLoss, calcCommission, calcDaysOnLot, BODY_TYPES, DRIVE_TYPES, TRANSMISSIONS, FUEL_TYPES, EXPENSE_CATEGORIES, TAX_TYPES, DEFAULT_TAX_TYPE, rateForTaxType } from "../../lib/vehicles";
import { buildStorageUrl, setFeaturedImage, removeImagePath } from "../../lib/media";

// ── Types ─────────────────────────────────────────────────────────────────────

export type VehicleFull = {
  vin: string;
  make: string | null;
  model: string | null;
  trim: string | null;
  series: string | null;
  body_type: string | null;
  engine_type: string | null;
  num_keys: number | null;
  drive_type: string | null;
  transmission: string | null;
  fuel_type: string | null;
  cylinders: number | null;
  doors: number | null;
  features: string[];
  description: string | null;
  year: number | null;
  colour: string | null;
  odometer: number | null;
  purchase_date: string | null;
  purchase_price: number | null;
  purchased_from_name: string | null;
  purchased_from_address: string | null;
  purchaser_name: string | null;
  purchaser_address: string | null;
  wholesale_price: number | null;
  advertised_price_cargurus: number | null;
  advertised_price_facebook: number | null;
  sale_price: number | null;
  sale_date: string | null;
  ownership_status: string | null;
  status: string | null;
  photography_status: string | null;
  garage_register_number: string | null;
  acquisition_bill_of_sale_path: string | null;
  safety_inspection_document_path: string | null;
  signed_bill_of_sale_path: string | null;
  signed_ownership_sale_picture_path: string | null;
  signed_ownership_acquisition_picture_path: string | null;
  commission_user_id: string | null;
  images_json: string[];
  videos_json: string[];
  carfax_link: string | null;
  lead_source: string | null;
  internal_notes: string | null;
  disclosures: string | null;
  days_on_lot?: number | null;
};

export type VehicleExpense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  receipt_file_path: string | null;
  reimbursed: boolean;
  vendor: string | null;
  expense_date: string | null;
  tax_amount: number | null;
  tax_type: string | null;
  tax_rate: number | null;
  created_at: string;
};

export type VehicleDoc = {
  id: string;
  document_type: string;
  file_path: string;
  description: string | null;
  created_at: string;
};

export type UserProfile = {
  id: string;
  email: string;
  commission_percentage: number | null;
};

type Props = {
  vehicle: VehicleFull;
  expenses: VehicleExpense[];
  documents: VehicleDoc[];
  users: UserProfile[];
  supabaseUrl: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_STATUSES = [
  "frontline_ready","in_deal","sold","on_lot_work_needed","pending_delivery",
  "pending_pickup","bodyshop","mechanic_ssc","detailing_shop","mechanic_repairs",
  "openlane_arbitration","sale_cancelled_by_arbitration","openlane_auction",
] as const;


function fmtStatus(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmt(n: number | null, prefix = "$") {
  if (n === null) return "—";
  return `${n < 0 ? "-" : ""}${prefix}${Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}


// ── Per-tab patch helper ──────────────────────────────────────────────────────

async function patchVehicle(vin: string, fields: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const res  = await fetch(`/api/vehicles/${vin}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error ?? "Save failed" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// ── Upload helper ─────────────────────────────────────────────────────────────

async function uploadFile(vin: string, context: "vehicle-image" | "vehicle-document", file: File) {
  const urlRes = await fetch("/api/vehicles/upload-url", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context, vin, contentType: file.type, fileSize: file.size, filename: file.name }),
  });
  if (!urlRes.ok) {
    const d = await urlRes.json().catch(() => ({}));
    throw new Error((d as { error?: string }).error ?? "Failed to get upload URL");
  }
  const { uploadUrl, storagePath } = await urlRes.json() as { uploadUrl: string; storagePath: string };
  const uploadRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!uploadRes.ok) throw new Error("Upload to storage failed");
  return storagePath as string;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const show = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);
  return { toast, show };
}

// ── Tab list ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: "basics",     label: "Basics" },
  { id: "purchase",   label: "Purchase" },
  { id: "pricing",    label: "Pricing" },
  { id: "media",      label: "Media" },
  { id: "documents",  label: "Documents" },
  { id: "expenses",   label: "Expenses" },
  { id: "commission", label: "Commission" },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Main component ────────────────────────────────────────────────────────────

export default function VehicleDetail({ vehicle, expenses: initExpenses, documents: initDocs, users, supabaseUrl }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("basics");
  const [v,         setV]         = useState(vehicle);
  const [expenses,  setExpenses]  = useState(initExpenses);
  const [docs,      setDocs]      = useState(initDocs);
  const { toast, show } = useToast();

  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount) + Number(e.tax_amount ?? 0), 0);
  const totalCost    = calcTotalCost(v.purchase_price, expenseTotal);
  const profitLoss   = calcProfitLoss(v.sale_price, totalCost);
  const commUser     = users.find((u) => u.id === v.commission_user_id) ?? null;
  const commission   = calcCommission(profitLoss, commUser?.commission_percentage ?? null);

  async function save(fields: Record<string, unknown>) {
    const result = await patchVehicle(v.vin, fields);
    if (result.ok) {
      setV((prev) => ({ ...prev, ...fields }));
      show("Saved!", true);
    } else {
      show(result.error ?? "Save failed", false);
    }
  }

  return (
    <div className="vd-wrap">
      {toast && <div className={`vd-toast ${toast.ok ? "vd-toast--ok" : "vd-toast--err"}`}>{toast.msg}</div>}

      {/* Header */}
      <div className="vd-header">
        <a href="/admin/inventory/" className="back-link">← Inventory</a>
        <div className="vd-title-row">
          <h1><code>{v.vin}</code></h1>
          <span className="vd-subtitle">{[v.year, v.make, v.model, v.trim].filter(Boolean).join(" ")}</span>
        </div>
      </div>

      {/* Tabs */}
      <nav className="vd-tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`vd-tab${activeTab === t.id ? " vd-tab--active" : ""}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="vd-content">
        {activeTab === "basics"     && <BasicsTab     v={v} onSave={save} show={show} />}
        {activeTab === "purchase"   && <PurchaseTab   v={v} onSave={save} />}
        {activeTab === "pricing"    && <PricingTab    v={v} totalCost={totalCost} profitLoss={profitLoss} onSave={save} />}
        {activeTab === "media"      && <MediaTab      v={v} supabaseUrl={supabaseUrl} onSave={save} show={show} />}
        {activeTab === "documents"  && <DocumentsTab  v={v} docs={docs} supabaseUrl={supabaseUrl} setDocs={setDocs} onSave={save} show={show} />}
        {activeTab === "expenses"   && <ExpensesTab   vin={v.vin} expenses={expenses} totalCost={totalCost} setExpenses={setExpenses} show={show} />}
        {activeTab === "commission" && <CommissionTab v={v} users={users} profitLoss={profitLoss} commission={commission} setV={setV} show={show} />}
      </div>

      <style>{`
        .vd-wrap { font-family: 'Inter', sans-serif; max-width: 900px; }
        .vd-toast {
          position: fixed; top: 20px; right: 20px; z-index: 9999;
          padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 500;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .vd-toast--ok  { background: #ecfdf5; color: #1a7f4b; border: 1px solid #86efac; }
        .vd-toast--err { background: #fef2f1; color: #b92111; border: 1px solid #fca5a5; }

        .vd-header { margin-bottom: 20px; }
        .back-link { font-size: 13px; color: #99a1b2; text-decoration: none; display: inline-block; margin-bottom: 10px; }
        .back-link:hover { color: #b92111; }
        .vd-title-row { display: flex; align-items: baseline; gap: 14px; }
        .vd-title-row h1 { font-size: 22px; font-weight: 800; color: #1a1d23; }
        .vd-title-row h1 code { font-family: monospace; font-size: 20px; }
        .vd-subtitle { font-size: 15px; color: #6b7280; }

        .vd-tabs {
          display: flex; gap: 0; border-bottom: 2px solid #e4e7ec; margin-bottom: 0;
          overflow-x: auto; flex-shrink: 0;
        }
        .vd-tab {
          padding: 10px 16px; font-size: 14px; font-weight: 500; color: #6b7280;
          border: none; background: none; cursor: pointer; white-space: nowrap;
          border-bottom: 2px solid transparent; margin-bottom: -2px;
          transition: color 0.12s, border-color 0.12s;
        }
        .vd-tab:hover { color: #1a1d23; }
        .vd-tab--active { color: #b92111; border-bottom-color: #b92111; font-weight: 600; }

        .vd-content { background: #fff; border: 1px solid #e4e7ec; border-top: none; border-radius: 0 0 10px 10px; padding: 24px; }

        /* Shared form styles used by sub-components */
        .f-grid   { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
        .f-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .f-field  { display: flex; flex-direction: column; gap: 5px; }
        .f-field label { font-size: 12px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.04em; }
        .f-field input, .f-field select, .f-field textarea {
          height: 36px; padding: 0 10px; border: 1px solid #e4e7ec; border-radius: 6px;
          font-size: 14px; color: #1a1d23; background: #fff; font-family: inherit;
        }
        .f-field textarea { height: auto; min-height: 100px; padding: 8px 10px; resize: vertical; }
        .f-field input:focus, .f-field select:focus, .f-field textarea:focus { outline: none; border-color: #b92111; }
        .f-field input:disabled, .f-field select:disabled { background: #f8f9fb; color: #6b7280; cursor: not-allowed; }
        .f-readonly { font-size: 14px; color: #374151; padding: 6px 0; font-weight: 600; }

        .save-row { display: flex; justify-content: flex-end; margin-top: 20px; padding-top: 16px; border-top: 1px solid #f0f2f5; }
        .btn-save { padding: 8px 20px; background: #b92111; color: #fff; border: none; border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-save:hover:not(:disabled) { background: #9e1c0e; }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-secondary { padding: 7px 14px; background: #f8f9fb; color: #1a1d23; border: 1px solid #e4e7ec; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .btn-secondary:hover { background: #f0f2f5; }
        .btn-danger { padding: 5px 12px; background: #fef2f1; color: #b92111; border: 1px solid #fca5a5; border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .btn-danger:hover { background: #fee2e2; }
        .btn-sm-add { padding: 7px 14px; background: #1a7f4b22; color: #1a7f4b; border: 1px solid #86efac; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 16px; }

        .computed-row { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 16px; padding: 14px; background: #f8f9fb; border-radius: 8px; }
        .computed-item { display: flex; flex-direction: column; gap: 3px; }
        .computed-item .label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #99a1b2; }
        .computed-item .value { font-size: 18px; font-weight: 700; color: #1a1d23; }
        .computed-item .value.negative { color: #b92111; }
        .computed-item .value.positive { color: #1a7f4b; }
      `}</style>
    </div>
  );
}

// ── Basics Tab ────────────────────────────────────────────────────────────────

function BasicsTab({ v, onSave, show }: { v: VehicleFull; onSave: (f: Record<string, unknown>) => Promise<void>; show: (msg: string, ok: boolean) => void }) {
  const [form, setForm] = useState({
    make:                  v.make ?? "",
    model:                 v.model ?? "",
    trim:                  v.trim ?? "",
    series:                v.series ?? "",
    body_type:             v.body_type ?? "",
    engine_type:           v.engine_type ?? "",
    year:                  String(v.year ?? ""),
    colour:                v.colour ?? "",
    odometer:              v.odometer != null ? v.odometer.toLocaleString("en-CA") : "",
    num_keys:              v.num_keys != null ? String(v.num_keys) : "",
    drive_type:            v.drive_type ?? "",
    transmission:          v.transmission ?? "",
    fuel_type:             v.fuel_type ?? "",
    cylinders:             v.cylinders != null ? String(v.cylinders) : "",
    doors:                 v.doors != null ? String(v.doors) : "",
    status:                v.status ?? "",
    ownership_status:      v.ownership_status ?? "",
    photography_status:    v.photography_status ?? "",
    garage_register_number: v.garage_register_number ?? "",
    carfax_link:           v.carfax_link ?? "",
  });
  const [internalNotes, setInternalNotes] = useState(v.internal_notes ?? "");
  const [disclosures,   setDisclosures]   = useState(v.disclosures ?? "");
  const [description,   setDescription]  = useState(v.description ?? "");
  const [features,      setFeatures]      = useState<string[]>(v.features ?? []);
  const [newFeature,    setNewFeature]    = useState("");
  const [saving, setSaving] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);

  const daysOnLot = calcDaysOnLot(v.purchase_date);

  function set(k: keyof typeof form, val: string) { setForm((f) => ({ ...f, [k]: val })); }

  async function autoSave(field: "internal_notes" | "disclosures" | "description", value: string) {
    await onSave({ [field]: value || null });
  }

  async function generateDescription() {
    setGeneratingDescription(true);
    try {
      const res = await fetch(`/api/vehicles/${v.vin}/generate-description`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        show((data as { error?: string }).error ?? "Failed to generate description", false);
        return;
      }
      setDescription((data as { description: string }).description);
      show("Description generated — review and save.", true);
    } catch {
      show("Network error while generating description", false);
    } finally {
      setGeneratingDescription(false);
    }
  }

  async function addFeature() {
    const value = newFeature.trim();
    if (!value || features.includes(value)) return;
    const next = [...features, value];
    setFeatures(next);
    setNewFeature("");
    await onSave({ features: next });
  }

  async function removeFeature(feature: string) {
    const next = features.filter((f) => f !== feature);
    setFeatures(next);
    await onSave({ features: next });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const fields: Record<string, unknown> = { make: form.make, model: form.model };
    if (form.trim)        fields.trim        = form.trim;
    if (form.series)      fields.series      = form.series;
    if (form.body_type)   fields.body_type   = form.body_type;
    fields.engine_type           = form.engine_type || null;
    if (form.year)        fields.year        = parseInt(form.year);
    if (form.colour)      fields.colour      = form.colour;
    if (form.odometer)    fields.odometer    = parseInt(form.odometer.replace(/,/g, ""));
    fields.num_keys              = form.num_keys !== "" ? parseInt(form.num_keys) : null;
    fields.drive_type            = form.drive_type || null;
    fields.transmission          = form.transmission || null;
    fields.fuel_type             = form.fuel_type || null;
    fields.cylinders             = form.cylinders !== "" ? parseInt(form.cylinders) : null;
    fields.doors                 = form.doors !== "" ? parseInt(form.doors) : null;
    fields.status                = form.status || null;
    fields.ownership_status      = form.ownership_status || null;
    fields.photography_status    = form.photography_status || null;
    fields.garage_register_number = form.garage_register_number || null;
    fields.carfax_link           = form.carfax_link || null;
    await onSave(fields); setSaving(false);
  }

  return (
    <form onSubmit={submit}>
      <div className="f-field" style={{ marginBottom: 16 }}>
        <label>VIN</label>
        <input value={v.vin} disabled />
      </div>
      <div className="f-grid">
        <div className="f-field"><label>Make *</label><input value={form.make} onChange={(e) => set("make", e.target.value)} required /></div>
        <div className="f-field"><label>Model *</label><input value={form.model} onChange={(e) => set("model", e.target.value)} required /></div>
        <div className="f-field"><label>Year</label><input type="number" value={form.year} onChange={(e) => set("year", e.target.value)} min="1900" max="2100" /></div>
        <div className="f-field"><label>Trim</label><input value={form.trim} onChange={(e) => set("trim", e.target.value)} /></div>
        <div className="f-field"><label>Series</label><input value={form.series} onChange={(e) => set("series", e.target.value)} /></div>
        <div className="f-field">
          <label>Body Type *</label>
          <select value={form.body_type} onChange={(e) => set("body_type", e.target.value)} required>
            <option value="">— Select —</option>
            {BODY_TYPES.map((bt) => (
              <option key={bt} value={bt}>{bt.charAt(0).toUpperCase() + bt.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="f-field"><label>Engine Type</label><input value={form.engine_type} onChange={(e) => set("engine_type", e.target.value)} placeholder="e.g. 2.0L 4-Cylinder" /></div>
        <div className="f-field"><label>Colour</label><input value={form.colour} onChange={(e) => set("colour", e.target.value)} /></div>
        <div className="f-field"><label>Odometer (km)</label><input type="text" inputMode="numeric" value={form.odometer} onChange={(e) => set("odometer", e.target.value)} placeholder="e.g. 45,000" /></div>
        <div className="f-field"><label>Number of Keys</label><input type="number" min="0" max="10" value={form.num_keys} onChange={(e) => set("num_keys", e.target.value)} placeholder="e.g. 2" /></div>
        <div className="f-field">
          <label>Drive Type</label>
          <select value={form.drive_type} onChange={(e) => set("drive_type", e.target.value)}>
            <option value="">— Select —</option>
            {DRIVE_TYPES.map((dt) => (
              <option key={dt} value={dt}>{dt.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div className="f-field">
          <label>Transmission</label>
          <select value={form.transmission} onChange={(e) => set("transmission", e.target.value)}>
            <option value="">— Select —</option>
            {TRANSMISSIONS.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="f-field">
          <label>Fuel Type</label>
          <select value={form.fuel_type} onChange={(e) => set("fuel_type", e.target.value)}>
            <option value="">— Select —</option>
            {FUEL_TYPES.map((ft) => (
              <option key={ft} value={ft}>{ft.charAt(0).toUpperCase() + ft.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="f-field"><label>Cylinders</label><input type="number" min="1" max="16" value={form.cylinders} onChange={(e) => set("cylinders", e.target.value)} placeholder="e.g. 4" /></div>
        <div className="f-field"><label>Doors</label><input type="number" min="2" max="6" value={form.doors} onChange={(e) => set("doors", e.target.value)} placeholder="e.g. 4" /></div>
        <div className="f-field"><label>Carfax Link</label><input type="url" value={form.carfax_link} onChange={(e) => set("carfax_link", e.target.value)} placeholder="https://www.carfax.ca/..." /></div>
      </div>

      {daysOnLot !== null && (
        <div className="computed-row" style={{ marginTop: 16 }}>
          <div className="computed-item">
            <span className="label">Days on Lot</span>
            <span className="value">{daysOnLot} {daysOnLot === 1 ? "day" : "days"}</span>
          </div>
        </div>
      )}

      {/* Status fields */}
      <div style={{ borderTop: "1px solid #f0f2f5", paddingTop: 20, marginTop: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#99a1b2", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>Status</h3>
        <div className="f-grid">
          <div className="f-field">
            <label>Status</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="">— None —</option>
              {VALID_STATUSES.map((s) => (
                <option key={s} value={s}>{fmtStatus(s)}</option>
              ))}
            </select>
          </div>
          <div className="f-field">
            <label>Ownership Status</label>
            <select value={form.ownership_status} onChange={(e) => set("ownership_status", e.target.value)}>
              <option value="">— Select —</option>
              <option value="available">Available</option>
              <option value="en_route">En Route</option>
              <option value="not_received">Not Received</option>
            </select>
          </div>
          <div className="f-field">
            <label>Photography Status</label>
            <select value={form.photography_status} onChange={(e) => set("photography_status", e.target.value)}>
              <option value="">— Select —</option>
              <option value="pending">Pending</option>
              <option value="done">Done</option>
              <option value="na">N/A</option>
            </select>
          </div>
          <div className="f-field">
            <label>Garage Register #</label>
            <input value={form.garage_register_number} onChange={(e) => set("garage_register_number", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="save-row"><button type="submit" className="btn-save" disabled={saving}>{saving ? "Saving…" : "Save"}</button></div>

      {/* Public Listing — shown on the website; features/description save immediately, independent of the form above */}
      <div style={{ borderTop: "1px solid #f0f2f5", paddingTop: 20, marginTop: 8, display: "flex", flexDirection: "column", gap: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#99a1b2", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Public Listing</h3>
        <div className="f-field">
          <label>Features</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {features.map((f) => (
              <span key={f} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f8f9fb", border: "1px solid #e4e7ec", borderRadius: 999, padding: "4px 6px 4px 12px", fontSize: 13 }}>
                {f}
                <button type="button" onClick={() => removeFeature(f)} aria-label={`Remove ${f}`} style={{ border: "none", background: "none", color: "#99a1b2", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "0 4px" }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newFeature}
              onChange={(e) => setNewFeature(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }}
              placeholder="e.g. Backup Camera, Heated Seats"
              style={{ flex: 1 }}
            />
            <button type="button" className="btn-secondary" onClick={addFeature}>Add</button>
          </div>
        </div>
        <div className="f-field">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ margin: 0 }}>Public Description</label>
            <button
              type="button"
              className="btn-secondary"
              onClick={generateDescription}
              disabled={generatingDescription}
            >
              {generatingDescription ? "Generating…" : "Generate Description"}
            </button>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={(e) => autoSave("description", e.target.value)}
            rows={5}
            placeholder="Marketing description shown on the public listing page…"
          />
        </div>
        <p style={{ fontSize: 12, color: "#99a1b2", margin: 0 }}>Description auto-saves when you click away. Features save immediately when added or removed.</p>
      </div>

      {/* Notes — auto-save on blur */}
      <div style={{ borderTop: "1px solid #f0f2f5", paddingTop: 20, marginTop: 8, display: "flex", flexDirection: "column", gap: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#99a1b2", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Notes</h3>
        <div className="f-field">
          <label>Internal Notes</label>
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            onBlur={(e) => autoSave("internal_notes", e.target.value)}
            rows={4}
            placeholder="Internal notes visible to staff only…"
          />
        </div>
        <div className="f-field">
          <label>Disclosures</label>
          <textarea
            value={disclosures}
            onChange={(e) => setDisclosures(e.target.value)}
            onBlur={(e) => autoSave("disclosures", e.target.value)}
            rows={4}
            placeholder="Disclosures shown on bill of sale…"
          />
        </div>
        <p style={{ fontSize: 12, color: "#99a1b2", margin: 0 }}>Notes auto-save when you click away from the text area.</p>
      </div>
    </form>
  );
}

// ── Purchase Tab ──────────────────────────────────────────────────────────────

function PurchaseTab({ v, onSave }: { v: VehicleFull; onSave: (f: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ purchase_date: v.purchase_date ?? "", purchase_price: v.purchase_price != null ? v.purchase_price.toLocaleString("en-CA") : "", purchased_from_name: v.purchased_from_name ?? "", purchased_from_address: v.purchased_from_address ?? "", lead_source: v.lead_source ?? "", purchaser_name: v.purchaser_name ?? "", purchaser_address: v.purchaser_address ?? "" });
  const [saving, setSaving] = useState(false);

  function set(k: keyof typeof form, val: string) { setForm((f) => ({ ...f, [k]: val })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const fields: Record<string, unknown> = {};
    if (form.purchase_date)    fields.purchase_date    = form.purchase_date;
    if (form.purchase_price)        fields.purchase_price        = parseFloat(form.purchase_price.replace(/,/g, ""));
    if (form.purchased_from_name)   fields.purchased_from_name   = form.purchased_from_name;
    if (form.purchased_from_address) fields.purchased_from_address = form.purchased_from_address;
    fields.lead_source              = form.lead_source || null;
    if (form.purchaser_name)        fields.purchaser_name        = form.purchaser_name;
    if (form.purchaser_address)     fields.purchaser_address     = form.purchaser_address;
    await onSave(fields); setSaving(false);
  }

  const today = new Date().toISOString().slice(0, 10);
  return (
    <form onSubmit={submit}>
      <div className="f-grid">
        <div className="f-field"><label>Purchase Date</label><input type="date" value={form.purchase_date} onChange={(e) => set("purchase_date", e.target.value)} max={today} /></div>
        <div className="f-field"><label>Purchase Price (CAD)</label><input type="text" inputMode="decimal" value={form.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} placeholder="e.g. 25,000" /></div>
        <div className="f-field"><label>Lead Source</label><input value={form.lead_source} onChange={(e) => set("lead_source", e.target.value)} placeholder="e.g. CarGurus, Facebook, Referral" /></div>
        <div className="f-field" style={{ gridColumn: "1 / -1" }}><label>Purchased From — Name</label><input value={form.purchased_from_name} onChange={(e) => set("purchased_from_name", e.target.value)} placeholder="Previous owner or auction house" /></div>
        <div className="f-field" style={{ gridColumn: "1 / -1" }}><label>Purchased From — Address</label><input value={form.purchased_from_address} onChange={(e) => set("purchased_from_address", e.target.value)} placeholder="Street address, city, province" /></div>
        <div className="f-field" style={{ gridColumn: "1 / -1" }}><label>Sold To — Name</label><input value={form.purchaser_name} onChange={(e) => set("purchaser_name", e.target.value)} placeholder="Buyer's full name" /></div>
        <div className="f-field" style={{ gridColumn: "1 / -1" }}><label>Sold To — Address</label><input value={form.purchaser_address} onChange={(e) => set("purchaser_address", e.target.value)} placeholder="Buyer's street address, city, province" /></div>
      </div>
      <div className="save-row"><button type="submit" className="btn-save" disabled={saving}>{saving ? "Saving…" : "Save"}</button></div>
    </form>
  );
}

// ── Pricing Tab ───────────────────────────────────────────────────────────────

function PricingTab({ v, totalCost, profitLoss, onSave }: { v: VehicleFull; totalCost: number | null; profitLoss: number | null; onSave: (f: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ wholesale_price: v.wholesale_price != null ? v.wholesale_price.toLocaleString("en-CA") : "", advertised_price_cargurus: v.advertised_price_cargurus != null ? v.advertised_price_cargurus.toLocaleString("en-CA") : "", advertised_price_facebook: v.advertised_price_facebook != null ? v.advertised_price_facebook.toLocaleString("en-CA") : "", sale_price: v.sale_price != null ? v.sale_price.toLocaleString("en-CA") : "", sale_date: v.sale_date ?? "" });
  const [saving, setSaving] = useState(false);

  function set(k: keyof typeof form, val: string) { setForm((f) => ({ ...f, [k]: val })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const fields: Record<string, unknown> = {};
    if (form.wholesale_price)  fields.wholesale_price  = parseFloat(form.wholesale_price.replace(/,/g, ""));
    fields.advertised_price_cargurus = form.advertised_price_cargurus ? parseFloat(form.advertised_price_cargurus.replace(/,/g, "")) : null;
    fields.advertised_price_facebook = form.advertised_price_facebook ? parseFloat(form.advertised_price_facebook.replace(/,/g, "")) : null;
    fields.sale_price = form.sale_price ? parseFloat(form.sale_price.replace(/,/g, "")) : null;
    fields.sale_date  = form.sale_date || null;
    await onSave(fields); setSaving(false);
  }

  const plColor = profitLoss === null ? "#6b7280" : profitLoss >= 0 ? "positive" : "negative";
  return (
    <form onSubmit={submit}>
      <div className="f-grid">
        <div className="f-field"><label>Wholesale Price (CAD)</label><input type="text" inputMode="decimal" value={form.wholesale_price} onChange={(e) => set("wholesale_price", e.target.value)} placeholder="e.g. 18,000" /></div>
        <div className="f-field"><label>CarGurus Price (CAD)</label><input type="text" inputMode="decimal" value={form.advertised_price_cargurus} onChange={(e) => set("advertised_price_cargurus", e.target.value)} placeholder="e.g. 22,500" /></div>
        <div className="f-field"><label>Facebook Price (CAD)</label><input type="text" inputMode="decimal" value={form.advertised_price_facebook} onChange={(e) => set("advertised_price_facebook", e.target.value)} placeholder="e.g. 21,000" /></div>
        <div className="f-field"><label>Sale Price (CAD)</label><input type="text" inputMode="decimal" value={form.sale_price} onChange={(e) => set("sale_price", e.target.value)} placeholder="Leave empty if not sold" /></div>
        <div className="f-field"><label>Sale Date</label><input type="date" value={form.sale_date} onChange={(e) => set("sale_date", e.target.value)} max={new Date().toISOString().slice(0, 10)} /></div>
      </div>
      <div className="computed-row">
        <div className="computed-item"><span className="label">Total Cost</span><span className="value">{fmt(totalCost)}</span></div>
        <div className="computed-item"><span className="label">Profit / Loss</span><span className={`value ${plColor}`}>{profitLoss === null ? "—" : fmt(profitLoss)}</span></div>
      </div>
      <div className="save-row"><button type="submit" className="btn-save" disabled={saving}>{saving ? "Saving…" : "Save"}</button></div>
    </form>
  );
}

// ── Media Tab ─────────────────────────────────────────────────────────────────

function MediaTab({ v, supabaseUrl, onSave, show }: { v: VehicleFull; supabaseUrl: string; onSave: (f: Record<string, unknown>) => Promise<void>; show: (msg: string, ok: boolean) => void }) {
  const [images,    setImages]    = useState<string[]>(v.images_json ?? []);
  const [videos,    setVideos]    = useState<string[]>(v.videos_json ?? []);
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);

  async function uploadImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const paths = [...images];
    for (const file of Array.from(files)) {
      try {
        const path = await uploadFile(v.vin, "vehicle-image", file);
        paths.push(path);
      } catch (err) {
        show((err as Error).message ?? "Upload failed", false);
      }
    }
    setImages(paths);
    const result = await patchVehicle(v.vin, { images_json: paths });
    if (result.ok) show("Images saved!", true); else show(result.error ?? "Save failed", false);
    setUploading(false);
  }

  async function removeImage(path: string) {
    const next = removeImagePath(images, path);
    setImages(next);
    const result = await patchVehicle(v.vin, { images_json: next });
    if (!result.ok) show(result.error ?? "Save failed", false);
  }

  async function setFeatured(path: string) {
    const next = setFeaturedImage(images, path);
    if (next === images) return; // already featured — no change
    setImages(next);
    const result = await patchVehicle(v.vin, { images_json: next });
    if (result.ok) show("Featured image updated!", true); else show(result.error ?? "Save failed", false);
  }

  async function uploadVideo(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const paths = [...videos];
    for (const file of Array.from(files)) {
      try {
        const path = await uploadFile(v.vin, "vehicle-image", file);
        paths.push(path);
      } catch (err) {
        show((err as Error).message ?? "Upload failed", false);
      }
    }
    setVideos(paths);
    const result = await patchVehicle(v.vin, { videos_json: paths });
    if (result.ok) show("Videos saved!", true); else show(result.error ?? "Save failed", false);
    setUploading(false);
  }

  // suppress unused-prop warning — onSave is part of the shared tab interface
  void onSave;

  return (
    <div>
      {/* Images */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Images ({images.length})</h3>
        <p style={{ fontSize: 12, color: "#99a1b2", marginBottom: 12 }}>The first image is the featured photo shown on the website. Click "Set as Featured" to reorder.</p>
        <div className="media-grid">
          {images.map((path, idx) => (
            <div key={path} className={`media-thumb${idx === 0 ? " media-thumb--featured" : ""}`}>
              <img src={buildStorageUrl(supabaseUrl, "vehicle-images", path)} alt="" />
              {idx === 0 && <span className="media-featured-badge">★ Featured</span>}
              {idx !== 0 && (
                <button type="button" className="media-set-featured" onClick={() => setFeatured(path)} title="Set as featured">
                  Set as Featured
                </button>
              )}
              <button type="button" className="media-remove" onClick={() => removeImage(path)}>×</button>
            </div>
          ))}
          <label className={`media-add${uploading ? " media-add--loading" : ""}`}>
            {uploading ? "Uploading…" : "+ Add Images"}
            <input ref={imgRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple onChange={(e) => uploadImages(e.target.files)} style={{ display: "none" }} />
          </label>
        </div>
      </div>

      {/* Videos */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Videos ({videos.length})</h3>
        <div className="media-grid">
          {videos.map((path) => (
            <div key={path} className="media-thumb media-thumb--video">
              <video src={buildStorageUrl(supabaseUrl, "vehicle-images", path)} controls preload="metadata" />
<button
  type="button"
  className="media-remove"
  onClick={async () => {
    const prev = videos;
    const next = prev.filter((p) => p !== path);
    setVideos(next);
    const result = await patchVehicle(v.vin, { videos_json: next });
    if (!result.ok) {
      setVideos(prev);
      show(result.error ?? "Save failed", false);
    }
  }}
>
  ×
</button>
            </div>
          ))}
          <label className={`media-add${uploading ? " media-add--loading" : ""}`}>
            {uploading ? "Uploading…" : "+ Add Video"}
            <input ref={vidRef} type="file" accept="video/mp4,video/quicktime" multiple onChange={(e) => uploadVideo(e.target.files)} style={{ display: "none" }} />
          </label>
        </div>
      </div>

      <style>{`
        .media-grid { display: flex; flex-wrap: wrap; gap: 10px; }
        .media-thumb { position: relative; width: 120px; height: 90px; border-radius: 6px; overflow: hidden; border: 1px solid #e4e7ec; }
        .media-thumb--featured { border: 2px solid #f59e0b; }
        .media-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .media-thumb--video video { width: 100%; height: 100%; object-fit: cover; display: block; background: #000; }
        .media-remove { position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,0.6); color: #fff; border: none; cursor: pointer; font-size: 14px; line-height: 1; display: flex; align-items: center; justify-content: center; }
        .media-featured-badge { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(245,158,11,0.9); color: #fff; font-size: 10px; font-weight: 700; text-align: center; padding: 3px 0; }
        .media-set-featured { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.65); color: #fff; font-size: 10px; font-weight: 600; text-align: center; padding: 4px 0; border: none; cursor: pointer; opacity: 0; transition: opacity 0.15s; }
        .media-thumb:hover .media-set-featured { opacity: 1; }
        .media-add { display: flex; align-items: center; justify-content: center; width: 120px; height: 90px; border: 2px dashed #e4e7ec; border-radius: 6px; font-size: 13px; color: #99a1b2; cursor: pointer; text-align: center; }
        .media-add:hover { border-color: #b92111; color: #b92111; }
        .media-add--loading { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}


// ── Documents Tab ─────────────────────────────────────────────────────────────

const FIXED_DOCS: { key: keyof VehicleFull; label: string }[] = [
  { key: "acquisition_bill_of_sale_path",             label: "Acquisition Bill of Sale" },
  { key: "safety_inspection_document_path",           label: "Safety Inspection" },
  { key: "signed_bill_of_sale_path",                  label: "Signed Bill of Sale" },
  { key: "signed_ownership_sale_picture_path",        label: "Signed Ownership – Sale Picture" },
  { key: "signed_ownership_acquisition_picture_path", label: "Signed Ownership – Acquisition Picture" },
];

function DocumentsTab({ v, docs, supabaseUrl, setDocs, onSave, show }: { v: VehicleFull; docs: VehicleDoc[]; supabaseUrl: string; setDocs: React.Dispatch<React.SetStateAction<VehicleDoc[]>>; onSave: (f: Record<string, unknown>) => Promise<void>; show: (msg: string, ok: boolean) => void }) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [addForm, setAddForm]     = useState({ type: "", description: "", file: null as File | null });
  const [adding, setAdding]       = useState(false);
  const [showAdd, setShowAdd]     = useState(false);

  async function uploadFixed(key: keyof VehicleFull, file: File) {
    setUploading(key as string);
    try {
      const path   = await uploadFile(v.vin, "vehicle-document", file);
      await onSave({ [key]: path });
      show(`${FIXED_DOCS.find((d) => d.key === key)?.label} uploaded!`, true);
    } catch (err) {
      show((err as Error).message ?? "Upload failed", false);
    } finally {
      setUploading(null);
    }
  }

  async function addMiscDoc() {
    if (!addForm.type || !addForm.file) return;
    setAdding(true);
    try {
      const path = await uploadFile(v.vin, "vehicle-document", addForm.file);
      const res  = await fetch(`/api/vehicles/${v.vin}/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document_type: addForm.type, file_path: path, description: addForm.description || undefined }) });
      if (res.ok) {
        const newDoc = await res.json() as VehicleDoc;
        setDocs((d) => [...d, newDoc]);
        setAddForm({ type: "", description: "", file: null });
        setShowAdd(false);
        show("Document added!", true);
      } else {
        const d = await res.json().catch(() => ({}));
        show((d as { error?: string }).error ?? "Failed to add document", false);
      }
    } catch (err) {
      show((err as Error).message ?? "Upload failed", false);
    } finally {
      setAdding(false);
    }
  }

  async function deleteDoc(id: string) {
    if (!confirm("Delete this document?")) return;
    const res = await fetch(`/api/vehicles/${v.vin}/documents/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setDocs((d) => d.filter((doc) => doc.id !== id));
      show("Document deleted.", true);
    } else {
      show("Delete failed", false);
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Required Documents</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {FIXED_DOCS.map(({ key, label }) => {
          const path = v[key] as string | null;
          return (
            <div key={key as string} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#f8f9fb", borderRadius: 8 }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{label}</span>
              {path ? (
                <a href={buildStorageUrl(supabaseUrl, "vehicle-documents", path)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#1a7f4b", fontWeight: 600 }}>View ↗</a>
              ) : (
                <span style={{ fontSize: 12, color: "#99a1b2" }}>Not uploaded</span>
              )}
              <label className="btn-secondary" style={{ cursor: uploading === key as string ? "wait" : "pointer", opacity: uploading === key as string ? 0.6 : 1 }}>
                {uploading === key as string ? "Uploading…" : path ? "Replace" : "Upload"}
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => e.target.files && uploadFixed(key, e.target.files[0])} style={{ display: "none" }} />
              </label>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>Additional Documents ({docs.length})</h3>
        <button type="button" className="btn-sm-add" onClick={() => setShowAdd(!showAdd)}>+ Add Document</button>
      </div>

      {showAdd && (
        <div style={{ padding: 16, background: "#f8f9fb", borderRadius: 8, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="f-grid-2">
            <div className="f-field"><label>Document Type *</label><input value={addForm.type} onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))} placeholder="e.g. warranty, service_record" /></div>
            <div className="f-field"><label>Description</label><input value={addForm.description} onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <div className="f-field">
            <label>File *</label>
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setAddForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-save" onClick={addMiscDoc} disabled={adding || !addForm.type || !addForm.file}>{adding ? "Adding…" : "Add"}</button>
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {docs.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e4e7ec", borderRadius: 8, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Type","Description","File","Actions"].map((h) => <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#99a1b2", borderBottom: "1px solid #e4e7ec" }}>{h}</th>)}</tr></thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id}>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{doc.document_type}</td>
                  <td style={{ padding: "10px 14px", color: "#6b7280" }}>{doc.description ?? "—"}</td>
                  <td style={{ padding: "10px 14px" }}><a href={buildStorageUrl(supabaseUrl, "vehicle-documents", doc.file_path)} target="_blank" rel="noopener noreferrer" style={{ color: "#1a7f4b", fontWeight: 600 }}>View ↗</a></td>
                  <td style={{ padding: "10px 14px" }}><button type="button" className="btn-danger" onClick={() => deleteDoc(doc.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Expenses Tab ──────────────────────────────────────────────────────────────

function ExpensesTab({ vin, expenses, totalCost, setExpenses, show }: { vin: string; expenses: VehicleExpense[]; totalCost: number | null; setExpenses: React.Dispatch<React.SetStateAction<VehicleExpense[]>>; show: (msg: string, ok: boolean) => void }) {
  const [form, setForm]   = useState({ category: "repair" as string, description: "", amount: "", vendor: "", expense_date: "", tax_type: DEFAULT_TAX_TYPE as string, tax_amount: "" });
  const [taxAmountTouched, setTaxAmountTouched] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding]  = useState(false);

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
    if (!form.description || !form.amount) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/vehicles/${vin}/expenses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        vendor: form.vendor || undefined,
        expense_date: form.expense_date || undefined,
        tax_type: form.tax_type,
        tax_rate: rateForTaxType(form.tax_type),
        tax_amount: form.tax_amount ? parseFloat(form.tax_amount) : undefined,
      }) });
      if (res.ok || res.status === 201) {
        const newExp = await res.json() as VehicleExpense;
        setExpenses((e) => [...e, newExp]);
        setForm({ category: "repair", description: "", amount: "", vendor: "", expense_date: "", tax_type: DEFAULT_TAX_TYPE, tax_amount: "" });
        setTaxAmountTouched(false);
        setShowAdd(false);
        show("Expense added!", true);
      } else {
        const d = await res.json().catch(() => ({}));
        show((d as { error?: string }).error ?? "Failed to add expense", false);
      }
    } catch {
      show("Network error", false);
    } finally {
      setAdding(false);
    }
  }

  async function deleteExpense(id: string) {
    if (!confirm("Delete this expense?")) return;
    const res = await fetch(`/api/vehicles/${vin}/expenses/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setExpenses((e) => e.filter((exp) => exp.id !== id));
      show("Expense deleted.", true);
    } else {
      show("Delete failed", false);
    }
  }

  async function toggleReimbursed(id: string, reimbursed: boolean) {
    setExpenses((e) => e.map((exp) => (exp.id === id ? { ...exp, reimbursed } : exp)));
    const res = await fetch(`/api/vehicles/${vin}/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reimbursed }),
    });
    if (!res.ok) {
      setExpenses((e) => e.map((exp) => (exp.id === id ? { ...exp, reimbursed: !reimbursed } : exp)));
      show("Failed to update reimbursed status", false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>Expenses ({expenses.length})</h3>
        <button type="button" className="btn-sm-add" onClick={() => setShowAdd(!showAdd)}>+ Add Expense</button>
      </div>

      {showAdd && (
        <div style={{ padding: 16, background: "#f8f9fb", borderRadius: 8, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="f-grid">
            <div className="f-field">
              <label>Category *</label>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{fmtStatus(c)}</option>)}
              </select>
            </div>
            <div className="f-field"><label>Description *</label><input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the expense" /></div>
            <div className="f-field"><label>Amount ($) *</label><input type="number" value={form.amount} onChange={(e) => setAmount(e.target.value)} step="0.01" placeholder="Negative for refunds/credits" /></div>
            <div className="f-field"><label>Vendor</label><input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} placeholder="Who was paid" /></div>
            <div className="f-field"><label>Date</label><input type="date" value={form.expense_date} onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))} /></div>
            <div className="f-field">
              <label>Tax Type</label>
              <select value={form.tax_type} onChange={(e) => setTaxType(e.target.value)}>
                {TAX_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </div>
            <div className="f-field"><label>Tax Amount ($)</label><input type="number" value={form.tax_amount} onChange={(e) => { setTaxAmountTouched(true); setForm((f) => ({ ...f, tax_amount: e.target.value })); }} step="0.01" /></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-save" onClick={addExpense} disabled={adding || !form.description || !form.amount}>{adding ? "Adding…" : "Add Expense"}</button>
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {expenses.length > 0 ? (
        <div style={{ background: "#fff", border: "1px solid #e4e7ec", borderRadius: 8, overflow: "auto", marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Date","Category","Vendor","Description","Amount","Tax","Reimbursed","Actions"].map((h) => <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#99a1b2", borderBottom: "1px solid #e4e7ec" }}>{h}</th>)}</tr></thead>
            <tbody>
              {expenses.map((exp) => (
                <tr key={exp.id}>
                  <td style={{ padding: "10px 14px", color: "#374151", whiteSpace: "nowrap" }}>{exp.expense_date ? new Date(exp.expense_date).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) : "—"}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{fmtStatus(exp.category)}</td>
                  <td style={{ padding: "10px 14px", color: "#374151" }}>{exp.vendor ?? "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#374151" }}>{exp.description}</td>
                  <td style={{ padding: "10px 14px", fontVariantNumeric: "tabular-nums" }}>{fmt(exp.amount)}</td>
                  <td style={{ padding: "10px 14px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {exp.tax_amount != null ? fmt(exp.tax_amount) : "—"}
                    {exp.tax_type && <div style={{ fontSize: 11, color: "#99a1b2" }}>{TAX_TYPES.find((t) => t.code === exp.tax_type)?.label ?? exp.tax_type}</div>}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <input
                      type="checkbox"
                      checked={exp.reimbursed}
                      onChange={(e) => toggleReimbursed(exp.id, e.target.checked)}
                      aria-label={`Mark ${exp.description} as reimbursed`}
                    />
                  </td>
                  <td style={{ padding: "10px 14px" }}><button type="button" className="btn-danger" onClick={() => deleteExpense(exp.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: "#99a1b2", fontSize: 14, marginBottom: 12 }}>No expenses recorded yet.</p>
      )}

      <div className="computed-row" style={{ marginTop: 8 }}>
        <div className="computed-item"><span className="label">Total Cost (purchase + expenses)</span><span className="value">{fmt(totalCost)}</span></div>
      </div>
    </div>
  );
}

// ── Commission Tab ────────────────────────────────────────────────────────────

function CommissionTab({ v, users, profitLoss, commission, setV, show }: { v: VehicleFull; users: UserProfile[]; profitLoss: number | null; commission: number | null; setV: React.Dispatch<React.SetStateAction<VehicleFull>>; show: (msg: string, ok: boolean) => void }) {
  const [selectedId, setSelectedId] = useState(v.commission_user_id ?? "");
  const [saving, setSaving] = useState(false);

  const selectedUser = users.find((u) => u.id === selectedId) ?? null;

  async function save() {
    setSaving(true);
    try {
      const res  = await fetch(`/api/vehicles/${v.vin}/commission`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commission_user_id: selectedId || null }) });
      const data = await res.json();
      if (res.ok) {
        setV((prev) => ({ ...prev, commission_user_id: selectedId || null }));
        show("Commission saved!", true);
      } else {
        show((data as { error?: string }).error ?? "Save failed", false);
      }
    } catch {
      show("Network error", false);
    } finally {
      setSaving(false);
    }
  }

  const plColor = profitLoss === null ? "#6b7280" : profitLoss >= 0 ? "positive" : "negative";

  return (
    <div>
      <div className="f-field" style={{ maxWidth: 360, marginBottom: 20 }}>
        <label>Commission User</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">— None —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.email} ({u.commission_percentage !== null ? `${u.commission_percentage}%` : "no %"})</option>
          ))}
        </select>
      </div>

      <div className="computed-row">
        <div className="computed-item"><span className="label">Profit / Loss</span><span className={`value ${plColor}`}>{profitLoss === null ? "—" : fmt(profitLoss)}</span></div>
        <div className="computed-item"><span className="label">Commission %</span><span className="value">{selectedUser?.commission_percentage !== null && selectedUser?.commission_percentage !== undefined ? `${selectedUser.commission_percentage}%` : "—"}</span></div>
        <div className="computed-item"><span className="label">Commission</span><span className="value">{fmt(commission)}{profitLoss !== null && profitLoss < 0 && commission === 150 && <span style={{ fontSize: 11, color: "#99a1b2", marginLeft: 4 }}>(floor)</span>}</span></div>
      </div>

      <div className="save-row">
        <button type="button" className="btn-save" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

