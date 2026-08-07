import { useState } from "react";
import { BODY_TYPES, DRIVE_TYPES, TRANSMISSIONS, FUEL_TYPES } from "../../lib/vehicles";

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

type FormData = {
  vin: string;
  make: string;
  model: string;
  year: string;
  trim: string;
  series: string;
  body_type: string;
  engine_type: string;
  colour: string;
  odometer: string;
  num_keys: string;
  drive_type: string;
  transmission: string;
  fuel_type: string;
  cylinders: string;
  doors: string;
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

/** Pure validation of the Add Vehicle form — no DOM/React dependency, so it's unit-testable directly. */
export function validateVehicleForm(form: FormData): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!form.vin || !VIN_RE.test(form.vin)) errs.vin = "Valid 17-char VIN required";
  if (!form.make.trim()) errs.make = "Make is required";
  if (!form.model.trim()) errs.model = "Model is required";
  const year = parseInt(form.year);
  if (!year || year < 1900 || year > 2100) errs.year = "Valid year required";
  if (!form.body_type) errs.body_type = "Body type is required";
  return errs;
}

/**
 * Pure builder for the POST /api/vehicles request body — no DOM/React
 * dependency, so it's unit-testable directly. Every optional spec field the
 * form exposes must be listed here; a field present in the form but missing
 * from this function is exactly the class of bug that shipped `engine_type`
 * as silently omitted (see e2e/admin-vehicle-full-field-write.spec.ts).
 */
export function buildVehiclePayload(form: FormData): Record<string, unknown> {
  const body: Record<string, unknown> = {
    vin: form.vin,
    make: form.make.trim(),
    model: form.model.trim(),
    year: parseInt(form.year),
    body_type: form.body_type,
    status: form.status || null,
  };
  if (form.trim) body.trim = form.trim.trim();
  if (form.series) body.series = form.series.trim();
  if (form.engine_type) body.engine_type = form.engine_type.trim();
  if (form.colour) body.colour = form.colour.trim();
  if (form.odometer) body.odometer = parseInt(form.odometer.replace(/,/g, ""), 10);
  if (form.num_keys) body.num_keys = parseInt(form.num_keys, 10);
  if (form.drive_type) body.drive_type = form.drive_type;
  if (form.transmission) body.transmission = form.transmission;
  if (form.fuel_type) body.fuel_type = form.fuel_type;
  if (form.cylinders) body.cylinders = parseInt(form.cylinders, 10);
  if (form.doors) body.doors = parseInt(form.doors, 10);
  if (form.purchase_date) body.purchase_date = form.purchase_date;
  if (form.purchase_price) body.purchase_price = parseFloat(form.purchase_price.replace(/,/g, ""));
  if (form.wholesale_price) body.wholesale_price = parseFloat(form.wholesale_price.replace(/,/g, ""));
  if (form.advertised_price_cargurus) body.advertised_price_cargurus = parseFloat(form.advertised_price_cargurus.replace(/,/g, ""));
  if (form.advertised_price_facebook) body.advertised_price_facebook = parseFloat(form.advertised_price_facebook.replace(/,/g, ""));
  return body;
}

export default function AddVehicleForm() {
  const [form, setForm] = useState<FormData>({
    vin: "", make: "", model: "", year: String(new Date().getFullYear()),
    trim: "", series: "",
    body_type: "",
    engine_type: "", colour: "", odometer: "", num_keys: "",
    drive_type: "", transmission: "", fuel_type: "", cylinders: "", doors: "",
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
    const errs = validateVehicleForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    const body = buildVehiclePayload(form);

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
                data-testid="av-vin"
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
              <input type="text" data-testid="av-make" value={form.make} onChange={(e) => set("make", e.target.value)} placeholder="e.g. Toyota" />
              {errors.make && <p className="field-err">{errors.make}</p>}
            </div>
            <div className="av-field">
              <label>Model *</label>
              <input type="text" data-testid="av-model" value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="e.g. Camry" />
              {errors.model && <p className="field-err">{errors.model}</p>}
            </div>
            <div className="av-field av-field--sm">
              <label>Year *</label>
              <input type="number" data-testid="av-year" value={form.year} onChange={(e) => set("year", e.target.value)} min="1900" max="2100" />
              {errors.year && <p className="field-err">{errors.year}</p>}
            </div>
          </div>
          <div className="av-row">
            <div className="av-field">
              <label>Trim</label>
              <input type="text" data-testid="av-trim" value={form.trim} onChange={(e) => set("trim", e.target.value)} />
            </div>
            <div className="av-field">
              <label>Series</label>
              <input type="text" data-testid="av-series" value={form.series} onChange={(e) => set("series", e.target.value)} />
            </div>
            <div className="av-field av-field--sm">
              <label>Body Type *</label>
              <select data-testid="av-body_type" value={form.body_type} onChange={(e) => set("body_type", e.target.value)}>
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
          <h2>Vehicle Specs</h2>
          <div className="av-row">
            <div className="av-field">
              <label>Engine Type</label>
              <input type="text" data-testid="av-engine_type" value={form.engine_type} onChange={(e) => set("engine_type", e.target.value)} placeholder="e.g. 2.0L Turbo" />
            </div>
            <div className="av-field">
              <label>Colour</label>
              <input type="text" data-testid="av-colour" value={form.colour} onChange={(e) => set("colour", e.target.value)} />
            </div>
            <div className="av-field">
              <label>Odometer (km)</label>
              <input type="text" inputMode="numeric" data-testid="av-odometer" value={form.odometer} onChange={(e) => set("odometer", e.target.value)} placeholder="e.g. 45,000" />
            </div>
            <div className="av-field av-field--sm">
              <label>Number of Keys</label>
              <input type="number" min="0" max="10" data-testid="av-num_keys" value={form.num_keys} onChange={(e) => set("num_keys", e.target.value)} placeholder="e.g. 2" />
            </div>
          </div>
          <div className="av-row">
            <div className="av-field">
              <label>Drive Type</label>
              <select data-testid="av-drive_type" value={form.drive_type} onChange={(e) => set("drive_type", e.target.value)}>
                <option value="">— Select —</option>
                {DRIVE_TYPES.map((dt) => (
                  <option key={dt} value={dt}>{dt.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div className="av-field">
              <label>Transmission</label>
              <select data-testid="av-transmission" value={form.transmission} onChange={(e) => set("transmission", e.target.value)}>
                <option value="">— Select —</option>
                {TRANSMISSIONS.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="av-field">
              <label>Fuel Type</label>
              <select data-testid="av-fuel_type" value={form.fuel_type} onChange={(e) => set("fuel_type", e.target.value)}>
                <option value="">— Select —</option>
                {FUEL_TYPES.map((ft) => (
                  <option key={ft} value={ft}>{ft.charAt(0).toUpperCase() + ft.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="av-field av-field--sm">
              <label>Cylinders</label>
              <input type="number" min="1" max="16" data-testid="av-cylinders" value={form.cylinders} onChange={(e) => set("cylinders", e.target.value)} placeholder="e.g. 4" />
            </div>
            <div className="av-field av-field--sm">
              <label>Doors</label>
              <input type="number" min="2" max="6" data-testid="av-doors" value={form.doors} onChange={(e) => set("doors", e.target.value)} placeholder="e.g. 4" />
            </div>
          </div>
        </div>

        <div className="av-section">
          <h2>Purchase Info</h2>
          <div className="av-row">
            <div className="av-field">
              <label>Purchase Date</label>
              <input type="date" data-testid="av-purchase_date" value={form.purchase_date} onChange={(e) => set("purchase_date", e.target.value)} max={new Date().toISOString().slice(0, 10)} />
              {errors.purchase_date && <p className="field-err">{errors.purchase_date}</p>}
            </div>
            <div className="av-field">
              <label>Purchase Price (CAD)</label>
              <input type="text" inputMode="decimal" data-testid="av-purchase_price" value={form.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} placeholder="e.g. 25,000" />
            </div>
          </div>
        </div>

        <div className="av-section">
          <h2>Pricing</h2>
          <div className="av-row">
            <div className="av-field">
              <label>Wholesale Price (CAD)</label>
              <input type="text" inputMode="decimal" data-testid="av-wholesale_price" value={form.wholesale_price} onChange={(e) => set("wholesale_price", e.target.value)} placeholder="e.g. 18,000" />
            </div>
            <div className="av-field">
              <label>CarGurus Price (CAD)</label>
              <input type="text" inputMode="decimal" data-testid="av-advertised_price_cargurus" value={form.advertised_price_cargurus} onChange={(e) => set("advertised_price_cargurus", e.target.value)} placeholder="e.g. 22,500" />
            </div>
            <div className="av-field">
              <label>Facebook Price (CAD)</label>
              <input type="text" inputMode="decimal" data-testid="av-advertised_price_facebook" value={form.advertised_price_facebook} onChange={(e) => set("advertised_price_facebook", e.target.value)} placeholder="e.g. 21,000" />
            </div>
          </div>
        </div>

        <div className="av-section">
          <h2>Status</h2>
          <div className="av-field" style={{ maxWidth: 280 }}>
            <label>Vehicle Status</label>
            <select data-testid="av-status" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="">— None —</option>
              {VALID_STATUSES.map((s) => (
                <option key={s} value={s}>{fmtStatus(s)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="av-actions">
          <a href="/admin/inventory/" className="btn btn--ghost">Cancel</a>
          <button type="submit" className="btn btn--primary" data-testid="av-submit" disabled={saving}>
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
