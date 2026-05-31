import { useState } from "react";
import { BODY_TYPES } from "../../lib/vehicles";

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

type FormData = {
  vin: string;
  make: string;
  model: string;
  year: string;
  body_type: string;
  purchase_date: string;
  purchase_price: string;
  wholesale_price: string;
  advertised_price_cargurus: string;
  advertised_price_facebook: string;
  status: string;
};

const VALID_STATUSES = [
  "frontline_ready", "in_deal", "sold", "on_lot_work_needed",
  "pending_delivery", "pending_pickup", "bodyshop", "mechanic_ssc",
  "detailing_shop", "mechanic_repairs", "openlane_arbitration",
  "sale_cancelled_by_arbitration", "openlane_auction",
] as const;

function fmtStatus(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AddVehicleForm() {
  const [form, setForm] = useState<FormData>({
    vin: "", make: "", model: "", year: String(new Date().getFullYear()),
    body_type: "",
    purchase_date: "", purchase_price: "", wholesale_price: "", advertised_price_cargurus: "", advertised_price_facebook: "",
    status: "",
  });
  const [vinError, setVinError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function set(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  }

  function onVinChange(val: string) {
    const v = val.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
    set("vin", v);
    if (v.length > 0 && v.length !== 17) setVinError("VIN must be exactly 17 characters");
    else if (v.length === 17 && !VIN_RE.test(v)) setVinError("VIN contains invalid characters");
    else setVinError("");
  }

async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.vin || !VIN_RE.test(form.vin))     errs.vin       = "Valid 17-char VIN required";
    if (!form.make.trim())                         errs.make      = "Make is required";
    if (!form.model.trim())                        errs.model     = "Model is required";
    const year = parseInt(form.year);
    if (!year || year < 1900 || year > 2100)       errs.year      = "Valid year required";
    if (!form.body_type)                           errs.body_type = "Body type is required";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    const body: Record<string, unknown> = {
      vin:       form.vin,
      make:      form.make.trim(),
      model:     form.model.trim(),
      year,
      body_type: form.body_type,
      status:    form.status || null,
    };
    if (form.purchase_date)  body.purchase_date  = form.purchase_date;
    if (form.purchase_price)  body.purchase_price  = parseFloat(form.purchase_price.replace(/,/g, ""));
    if (form.wholesale_price)          body.wholesale_price          = parseFloat(form.wholesale_price.replace(/,/g, ""));
    if (form.advertised_price_cargurus) body.advertised_price_cargurus = parseFloat(form.advertised_price_cargurus.replace(/,/g, ""));
    if (form.advertised_price_facebook) body.advertised_price_facebook = parseFloat(form.advertised_price_facebook.replace(/,/g, ""));

    try {
      const res  = await fetch("/api/vehicles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.status === 201) {
        setToast({ msg: "Vehicle added!", ok: true });
        setTimeout(() => { window.location.href = `/admin/inventory/${form.vin}`; }, 600);
      } else {
        setToast({ msg: (data as { error?: string }).error ?? "Failed to add vehicle", ok: false });
        if ((data as { errors?: Record<string, string[]> }).errors) {
          const fieldErrors: Record<string, string> = {};
          for (const [k, v] of Object.entries((data as { errors: Record<string, string[]> }).errors)) {
            fieldErrors[k] = v[0];
          }
          setErrors(fieldErrors);
        }
      }
    } catch {
      setToast({ msg: "Network error", ok: false });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  const vinLen = form.vin.length;
  const vinOk  = vinLen === 17 && VIN_RE.test(form.vin) && !vinError;

  return (
    <div className="av-wrap">
      {toast && <div className={`av-toast ${toast.ok ? "av-toast--ok" : "av-toast--err"}`}>{toast.msg}</div>}

      <div className="av-header">
        <a href="/admin/inventory/" className="back-link">← Inventory</a>
        <h1>Add Vehicle</h1>
        <p>Required fields are marked *. You can fill in the rest from the vehicle detail page.</p>
      </div>

      <form onSubmit={handleSubmit} className="av-form">
        <div className="av-section">
          <h2>Identification</h2>

          <div className="av-field">
            <label>VIN *</label>
            <div className="vin-input-wrap">
              <input
                type="text"
                value={form.vin}
                onChange={(e) => onVinChange(e.target.value)}
                maxLength={17}
                placeholder="17-character VIN"
                className={`vin-input ${vinOk ? "vin-ok" : ""} ${vinError || errors.vin ? "vin-err" : ""}`}
              />
              <span className={`vin-counter ${vinLen === 17 ? "vin-counter--full" : ""}`}>{vinLen}/17</span>
            </div>
            {(vinError || errors.vin) && <p className="field-err">{vinError || errors.vin}</p>}
          </div>

          <div className="av-row">
            <div className="av-field">
              <label>Make *</label>
              <input type="text" value={form.make} onChange={(e) => set("make", e.target.value)} placeholder="e.g. Toyota" />
              {errors.make && <p className="field-err">{errors.make}</p>}
            </div>
            <div className="av-field">
              <label>Model *</label>
              <input type="text" value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="e.g. Camry" />
              {errors.model && <p className="field-err">{errors.model}</p>}
            </div>
            <div className="av-field av-field--sm">
              <label>Year *</label>
              <input type="number" value={form.year} onChange={(e) => set("year", e.target.value)} min="1900" max="2100" />
              {errors.year && <p className="field-err">{errors.year}</p>}
            </div>
          </div>
          <div className="av-row">
            <div className="av-field av-field--sm">
              <label>Body Type *</label>
              <select value={form.body_type} onChange={(e) => set("body_type", e.target.value)}>
                <option value="">— Select —</option>
                {BODY_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{bt.charAt(0).toUpperCase() + bt.slice(1)}</option>
                ))}
              </select>
              {errors.body_type && <p className="field-err">{errors.body_type}</p>}
            </div>
          </div>
        </div>

        <div className="av-section">
          <h2>Purchase Info</h2>
          <div className="av-row">
            <div className="av-field">
              <label>Purchase Date</label>
              <input type="date" value={form.purchase_date} onChange={(e) => set("purchase_date", e.target.value)} max={new Date().toISOString().slice(0, 10)} />
              {errors.purchase_date && <p className="field-err">{errors.purchase_date}</p>}
            </div>
            <div className="av-field">
              <label>Purchase Price (CAD)</label>
              <input type="text" inputMode="decimal" value={form.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} placeholder="e.g. 25,000" />
            </div>
          </div>
        </div>

        <div className="av-section">
          <h2>Pricing</h2>
          <div className="av-row">
            <div className="av-field">
              <label>Wholesale Price (CAD)</label>
              <input type="text" inputMode="decimal" value={form.wholesale_price} onChange={(e) => set("wholesale_price", e.target.value)} placeholder="e.g. 18,000" />
            </div>
            <div className="av-field">
              <label>CarGurus Price (CAD)</label>
              <input type="text" inputMode="decimal" value={form.advertised_price_cargurus} onChange={(e) => set("advertised_price_cargurus", e.target.value)} placeholder="e.g. 22,500" />
            </div>
            <div className="av-field">
              <label>Facebook Price (CAD)</label>
              <input type="text" inputMode="decimal" value={form.advertised_price_facebook} onChange={(e) => set("advertised_price_facebook", e.target.value)} placeholder="e.g. 21,000" />
            </div>
          </div>
        </div>

        <div className="av-section">
          <h2>Status</h2>
          <div className="av-field" style={{ maxWidth: 280 }}>
            <label>Vehicle Status</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="">— None —</option>
              {VALID_STATUSES.map((s) => (
                <option key={s} value={s}>{fmtStatus(s)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="av-actions">
          <a href="/admin/inventory/" className="btn btn--ghost">Cancel</a>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? "Adding…" : "Add Vehicle"}
          </button>
        </div>
      </form>

      <style>{`
        .av-wrap { max-width: 720px; }
        .av-toast {
          position: fixed; top: 20px; right: 20px; z-index: 9999;
          padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 500;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .av-toast--ok  { background: #ecfdf5; color: #1a7f4b; border: 1px solid #86efac; }
        .av-toast--err { background: #fef2f1; color: #b92111; border: 1px solid #fca5a5; }

        .av-header { margin-bottom: 28px; }
        .back-link { font-size: 13px; color: #99a1b2; text-decoration: none; display: inline-block; margin-bottom: 8px; }
        .back-link:hover { color: #b92111; }
        .av-header h1 { font-size: 22px; font-weight: 800; color: #1a1d23; margin-bottom: 4px; }
        .av-header p  { font-size: 13px; color: #99a1b2; }

        .av-form { display: flex; flex-direction: column; gap: 20px; }
        .av-section { background: #fff; border: 1px solid #e4e7ec; border-radius: 10px; padding: 20px 24px; }
        .av-section h2 { font-size: 15px; font-weight: 700; color: #1a1d23; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #f0f2f5; }

        .av-field { display: flex; flex-direction: column; gap: 5px; flex: 1; }
        .av-field--sm { max-width: 120px; }
        .av-row { display: flex; gap: 16px; flex-wrap: wrap; }
        .av-field label { font-size: 13px; font-weight: 600; color: #374151; }
        .av-field input, .av-field select {
          height: 38px; padding: 0 12px; border: 1px solid #e4e7ec; border-radius: 6px;
          font-size: 14px; color: #1a1d23; background: #fff;
          transition: border-color 0.15s;
        }
        .av-field input:focus, .av-field select:focus { outline: none; border-color: #b92111; }

        .vin-input-wrap { position: relative; }
        .vin-input { width: 100%; padding-right: 52px !important; font-family: monospace; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; }
        .vin-ok   { border-color: #1a7f4b !important; }
        .vin-err  { border-color: #b92111 !important; }
        .vin-counter { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; font-weight: 600; color: #99a1b2; }
        .vin-counter--full { color: #1a7f4b; }
        .field-err { font-size: 12px; color: #b92111; margin: 0; }

.av-actions { display: flex; gap: 10px; justify-content: flex-end; padding-top: 4px; }
        .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; }
        .btn--primary { background: #b92111; color: #fff; }
        .btn--primary:hover:not(:disabled) { background: #9e1c0e; }
        .btn--primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn--ghost { background: #fff; color: #1a1d23; border: 1px solid #e4e7ec; }
        .btn--ghost:hover { background: #f8f9fb; }
      `}</style>
    </div>
  );
}
