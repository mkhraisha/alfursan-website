import { useState, useRef, Fragment } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const VEHICLE_FIELDS: { value: string; label: string }[] = [
  { value: "",                   label: "— Skip —" },
  { value: "vin",                label: "VIN" },
  { value: "make",               label: "Make" },
  { value: "model",              label: "Model" },
  { value: "year",               label: "Year" },
  { value: "trim",               label: "Trim" },
  { value: "series",             label: "Series" },
  { value: "body_type",          label: "Body Type" },
  { value: "colour",             label: "Colour" },
  { value: "odometer",           label: "Odometer (km)" },
  { value: "purchase_date",      label: "Purchase Date (YYYY-MM-DD)" },
  { value: "purchase_price",     label: "Purchase Price ($)" },
  { value: "wholesale_price",    label: "Wholesale Price ($)" },
  { value: "advertised_price_cargurus", label: "Advertised Price — CarGurus ($)" },
  { value: "advertised_price_facebook", label: "Advertised Price — Facebook ($)" },
  { value: "sale_price",         label: "Sale Price ($)" },
  { value: "sale_date",          label: "Sale Date (YYYY-MM-DD)" },
  { value: "ownership_status",   label: "Ownership Status" },
  { value: "status",             label: "Status" },
  { value: "photography_status", label: "Photography Status" },
  { value: "purchased_from_name",    label: "Purchased From — Name" },
  { value: "purchased_from_address", label: "Purchased From — Address" },
  { value: "purchaser_name",     label: "Purchaser Name" },
  { value: "purchaser_address",  label: "Purchaser Address" },
  { value: "engine_type",        label: "Engine Type" },
  { value: "num_keys",           label: "Number of Keys" },
  { value: "disclosures",        label: "Disclosures" },
  { value: "internal_notes",     label: "Internal Notes" },
  { value: "carfax_link",        label: "Carfax Link" },
];

type Step = 1 | 2 | 3 | 4 | 5;

type RowError = { row: number; vin?: string; column?: string; error: string };

type PreviewResult = {
  preview: Record<string, unknown>[];
  total_rows: number;
  valid_count: number;
  error_count: number;
  errors: RowError[];
};

type ImportResult = {
  created: number;
  failed: number;
  errors: RowError[];
};

// ── Main component ────────────────────────────────────────────────────────────

export default function CSVImport() {
  const [step,      setStep]      = useState<Step>(1);
  const [file,      setFile]      = useState<File | null>(null);
  const [headers,   setHeaders]   = useState<string[]>([]);
  const [mapping,   setMapping]   = useState<Record<string, string>>({});
  const [preview,   setPreview]   = useState<PreviewResult | null>(null);
  const [result,    setResult]    = useState<ImportResult | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Step 1: File selection ──────────────────────────────────────────────────

  async function onFileChange(f: File | null) {
    if (!f) return;
    if (!f.name.endsWith(".csv") && f.type !== "text/csv" && f.type !== "text/plain") {
      setError("Please select a .csv file.");
      return;
    }
    setError(null);
    setFile(f);

    // Parse headers client-side for the mapping step
    const text = await f.text();
    const firstLine = text.split(/\r?\n/)[0] ?? "";
    const cols = parseCSVRow(firstLine);
    setHeaders(cols.map((h) => h.trim()).filter(Boolean));

    // Auto-detect obvious mapping
    const auto: Record<string, string> = {};
    for (const col of cols) {
      const lower = col.trim().toLowerCase().replace(/\s+/g, "_");
      const match = VEHICLE_FIELDS.find(
        (f) => f.value === lower || f.label.toLowerCase() === col.trim().toLowerCase()
      );
      if (match?.value) auto[col.trim()] = match.value;
    }
    setMapping(auto);
  }

  // ── Step 2 → 3: Build mapping + fetch preview ───────────────────────────────

  async function fetchPreview() {
    if (!file) return;
    const hasMappedVin = Object.values(mapping).includes("vin");
    if (!hasMappedVin) { setError("You must map at least one column to VIN."); return; }
    setError(null);
    setLoading(true);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("mapping", JSON.stringify(mapping));
    fd.append("preview", "true");

    try {
      const res  = await fetch("/api/vehicles/import", { method: "POST", body: fd });
      const data = await res.json() as PreviewResult & { error?: string };
      if (!res.ok) { setError(data.error ?? "Preview failed"); return; }
      setPreview(data);
      setStep(3);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 4 → 5: Confirm import ──────────────────────────────────────────────

  async function runImport() {
    if (!file) return;
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("mapping", JSON.stringify(mapping));

    try {
      const res  = await fetch("/api/vehicles/import", { method: "POST", body: fd });
      const data = await res.json() as ImportResult & { error?: string };
      if (!res.ok) { setError(data.error ?? "Import failed"); return; }
      setResult(data);
      setStep(5);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep(1); setFile(null); setHeaders([]); setMapping({});
    setPreview(null); setResult(null); setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="ci-wrap">
      <div className="ci-header">
        <a href="/admin/inventory/" className="back-link">← Inventory</a>
        <h1>Import from CSV</h1>
        <p>Bulk-import vehicles from an OpenLane or custom CSV file.</p>
      </div>

      <Stepper current={step} />

      {error && <div className="ci-error">{error}</div>}

      <div className="ci-card">
        {step === 1 && <StepUpload fileRef={fileRef} onFile={onFileChange} file={file} onNext={() => { if (file) setStep(2); }} />}
        {step === 2 && <StepMap headers={headers} mapping={mapping} setMapping={setMapping} onBack={() => setStep(1)} onNext={fetchPreview} loading={loading} />}
        {step === 3 && preview && <StepPreview preview={preview} onBack={() => setStep(2)} onNext={() => setStep(4)} />}
        {step === 4 && preview && <StepConfirm preview={preview} onBack={() => setStep(3)} onConfirm={runImport} loading={loading} />}
        {step === 5 && result  && <StepSummary result={result} onReset={reset} />}
      </div>

      <style>{`
        .ci-wrap { max-width: 860px; font-family: 'Inter', sans-serif; }
        .ci-header { margin-bottom: 24px; }
        .back-link { font-size: 13px; color: #99a1b2; text-decoration: none; display: inline-block; margin-bottom: 8px; }
        .back-link:hover { color: #b92111; }
        .ci-header h1 { font-size: 22px; font-weight: 800; color: #1a1d23; margin-bottom: 4px; }
        .ci-header p  { font-size: 13px; color: #99a1b2; }

        .ci-error { background: #fef2f1; border: 1px solid #fca5a5; color: #b92111; padding: 10px 16px; border-radius: 8px; font-size: 14px; margin-bottom: 16px; }

        .ci-card { background: #fff; border: 1px solid #e4e7ec; border-radius: 10px; padding: 28px; }

        /* Stepper */
        .stepper { display: flex; align-items: center; margin-bottom: 24px; }
        .step-item { display: flex; align-items: center; gap: 8px; }
        .step-num { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
        .step-num--done    { background: #1a7f4b; color: #fff; }
        .step-num--active  { background: #b92111; color: #fff; }
        .step-num--pending { background: #f0f2f5; color: #99a1b2; }
        .step-label { font-size: 13px; font-weight: 500; white-space: nowrap; }
        .step-label--active  { color: #1a1d23; font-weight: 700; }
        .step-label--pending { color: #99a1b2; }
        .step-label--done    { color: #6b7280; }
        .step-sep { flex: 1; height: 1px; background: #e4e7ec; margin: 0 10px; min-width: 16px; }

        /* Upload step */
        .upload-zone { border: 2px dashed #e4e7ec; border-radius: 10px; padding: 40px; text-align: center; cursor: pointer; transition: border-color 0.15s; }
        .upload-zone:hover { border-color: #b92111; }
        .upload-zone--filled { border-color: #1a7f4b; background: #f0fdf4; }
        .upload-icon { font-size: 36px; margin-bottom: 10px; }
        .upload-text  { font-size: 15px; font-weight: 600; color: #1a1d23; margin-bottom: 4px; }
        .upload-hint  { font-size: 13px; color: #99a1b2; }

        /* Map step */
        .map-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .map-table th { text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 700; color: #99a1b2; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e4e7ec; }
        .map-table td { padding: 8px 12px; border-bottom: 1px solid #f0f2f5; vertical-align: middle; }
        .map-table tr:last-child td { border-bottom: none; }
        .map-select { width: 100%; height: 34px; padding: 0 8px; border: 1px solid #e4e7ec; border-radius: 6px; font-size: 13px; color: #1a1d23; background: #fff; }
        .map-select--mapped { border-color: #1a7f4b; background: #f0fdf4; }

        /* Preview step */
        .preview-stats { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
        .pstat { padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; }
        .pstat--ok  { background: #f0fdf4; color: #1a7f4b; }
        .pstat--err { background: #fef2f1; color: #b92111; }
        .pstat--neutral { background: #f8f9fb; color: #374151; }

        .preview-scroll { overflow-x: auto; border: 1px solid #e4e7ec; border-radius: 8px; }
        .preview-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .preview-table th { padding: 7px 12px; font-size: 10px; font-weight: 700; color: #99a1b2; text-transform: uppercase; border-bottom: 1px solid #e4e7ec; white-space: nowrap; text-align: left; }
        .preview-table td { padding: 7px 12px; border-bottom: 1px solid #f0f2f5; white-space: nowrap; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
        .preview-table tr:last-child td { border-bottom: none; }

        /* Summary step */
        .summary-hero { text-align: center; padding: 24px; }
        .summary-hero h2 { font-size: 28px; font-weight: 800; color: #1a1d23; margin-bottom: 8px; }
        .summary-counts { display: flex; gap: 20px; justify-content: center; margin-top: 12px; }
        .sc-item { padding: 12px 24px; border-radius: 8px; font-size: 18px; font-weight: 700; }
        .sc-item--ok  { background: #f0fdf4; color: #1a7f4b; }
        .sc-item--err { background: #fef2f1; color: #b92111; }
        .err-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 16px; }
        .err-table th { text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 700; color: #99a1b2; text-transform: uppercase; border-bottom: 1px solid #e4e7ec; }
        .err-table td { padding: 8px 12px; border-bottom: 1px solid #f0f2f5; }

        /* Buttons */
        .step-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px; padding-top: 20px; border-top: 1px solid #f0f2f5; }
        .btn { display: inline-flex; align-items: center; padding: 9px 20px; border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; text-decoration: none; }
        .btn--primary { background: #b92111; color: #fff; }
        .btn--primary:hover:not(:disabled) { background: #9e1c0e; }
        .btn--primary:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn--ghost { background: #fff; color: #1a1d23; border: 1px solid #e4e7ec; }
        .btn--ghost:hover { background: #f8f9fb; }
        .btn--green { background: #1a7f4b; color: #fff; }
        .btn--green:hover { background: #156940; }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const STEP_LABELS = ["Upload", "Map Columns", "Preview", "Confirm", "Done"];

function Stepper({ current }: { current: Step }) {
  return (
    <div className="stepper">
      {STEP_LABELS.map((label, i) => {
        const n = (i + 1) as Step;
        const done    = n < current;
        const active  = n === current;
        const pending = n > current;
        return (
          <Fragment key={n}>
            <div className="step-item">
              <div className={`step-num ${done ? "step-num--done" : active ? "step-num--active" : "step-num--pending"}`}>
                {done ? "✓" : n}
              </div>
              <span className={`step-label ${done ? "step-label--done" : active ? "step-label--active" : "step-label--pending"}`}>{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && <div className="step-sep" />}
          </Fragment>
        );
      })}
    </div>
  );
}

function StepUpload({ fileRef, onFile, file, onNext }: { fileRef: React.RefObject<HTMLInputElement | null>; onFile: (f: File | null) => void; file: File | null; onNext: () => void }) {
  return (
    <div>
      <label className={`upload-zone${file ? " upload-zone--filled" : ""}`}>
        <div className="upload-icon">{file ? "✅" : "📂"}</div>
        <div className="upload-text">{file ? file.name : "Click to select a CSV file"}</div>
        <div className="upload-hint">{file ? `${(file.size / 1024).toFixed(1)} KB` : "Accepts .csv files"}</div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          style={{ display: "none" }}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <div className="step-actions">
        <button type="button" className="btn btn--primary" disabled={!file} onClick={onNext}>Next: Map Columns →</button>
      </div>
    </div>
  );
}

function StepMap({ headers, mapping, setMapping, onBack, onNext, loading }: { headers: string[]; mapping: Record<string, string>; setMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>; onBack: () => void; onNext: () => void; loading: boolean }) {
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  return (
    <div>
      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
        Map each CSV column to a vehicle field. Unmapped columns will be skipped.
        <strong style={{ color: "#1a1d23" }}> VIN must be mapped.</strong>
      </p>
      <div style={{ overflow: "auto", maxHeight: 420 }}>
        <table className="map-table">
          <thead><tr><th>CSV Column</th><th>→ Vehicle Field</th></tr></thead>
          <tbody>
            {headers.map((h) => (
              <tr key={h}>
                <td><code style={{ fontSize: 13 }}>{h}</code></td>
                <td>
                  <select
                    className={`map-select${mapping[h] ? " map-select--mapped" : ""}`}
                    value={mapping[h] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                  >
                    {VEHICLE_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "#99a1b2", marginTop: 10 }}>{mappedCount} of {headers.length} columns mapped</p>
      <div className="step-actions">
        <button type="button" className="btn btn--ghost" onClick={onBack}>← Back</button>
        <button type="button" className="btn btn--primary" onClick={onNext} disabled={loading || !Object.values(mapping).includes("vin")}>
          {loading ? "Loading preview…" : "Preview →"}
        </button>
      </div>
    </div>
  );
}

function StepPreview({ preview, onBack, onNext }: { preview: PreviewResult; onBack: () => void; onNext: () => void }) {
  const cols = preview.preview.length > 0 ? Object.keys(preview.preview[0]) : [];
  return (
    <div>
      <div className="preview-stats">
        <span className="pstat pstat--neutral">Total rows: {preview.total_rows}</span>
        <span className="pstat pstat--ok">✓ Valid: {preview.valid_count}</span>
        {preview.error_count > 0 && <span className="pstat pstat--err">✕ Invalid: {preview.error_count}</span>}
      </div>

      {preview.preview.length > 0 && (
        <div className="preview-scroll">
          <table className="preview-table">
            <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {preview.preview.map((row, i) => (
                <tr key={i}>{cols.map((c) => <td key={c} title={String(row[c] ?? "")}>{String(row[c] ?? "—")}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview.errors.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#b92111", fontWeight: 600 }}>
            Show {preview.errors.length} validation error{preview.errors.length !== 1 ? "s" : ""}
          </summary>
          <table className="err-table" style={{ marginTop: 8 }}>
            <thead><tr><th>Row</th><th>VIN</th><th>Column</th><th>Error</th></tr></thead>
            <tbody>
              {preview.errors.map((e, i) => (
                <tr key={i}>
                  <td>#{e.row}</td>
                  <td>{e.vin ?? "—"}</td>
                  <td><code style={{ fontSize: 12 }}>{e.column ?? "—"}</code></td>
                  <td style={{ color: "#b92111" }}>{e.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <div className="step-actions">
        <button type="button" className="btn btn--ghost" onClick={onBack}>← Back</button>
        <button type="button" className="btn btn--primary" onClick={onNext} disabled={preview.valid_count === 0}>
          {preview.valid_count === 0 ? "No valid rows to import" : `Confirm Import (${preview.valid_count} rows) →`}
        </button>
      </div>
    </div>
  );
}

function StepConfirm({ preview, onBack, onConfirm, loading }: { preview: PreviewResult; onBack: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1a1d23", marginBottom: 8 }}>Ready to Import</h2>
      <p style={{ color: "#6b7280", fontSize: 15, marginBottom: 8 }}>
        <strong style={{ color: "#1a7f4b" }}>{preview.valid_count} valid vehicle{preview.valid_count !== 1 ? "s" : ""}</strong> will be added to inventory.
      </p>
      {preview.error_count > 0 && (
        <p style={{ color: "#b92111", fontSize: 14, marginBottom: 8 }}>
          {preview.error_count} invalid row{preview.error_count !== 1 ? "s" : ""} will be skipped.
        </p>
      )}
      <p style={{ color: "#99a1b2", fontSize: 13 }}>Duplicate VINs will be flagged in the summary and skipped.</p>
      <div className="step-actions" style={{ justifyContent: "center", marginTop: 28 }}>
        <button type="button" className="btn btn--ghost" onClick={onBack} disabled={loading}>← Back</button>
        <button type="button" className="btn btn--green" onClick={onConfirm} disabled={loading}>
          {loading ? "Importing…" : "Confirm Import"}
        </button>
      </div>
    </div>
  );
}

function StepSummary({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  return (
    <div>
      <div className="summary-hero">
        <div style={{ fontSize: 48 }}>{result.failed === 0 ? "🎉" : "✅"}</div>
        <h2>Import Complete</h2>
        <div className="summary-counts">
          <div className="sc-item sc-item--ok">✓ {result.created} created</div>
          {result.failed > 0 && <div className="sc-item sc-item--err">✕ {result.failed} failed</div>}
        </div>
      </div>

      {result.errors.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Failures</h3>
          <table className="err-table">
            <thead><tr><th>Row</th><th>VIN</th><th>Column</th><th>Reason</th></tr></thead>
            <tbody>
              {result.errors.map((e, i) => (
                <tr key={i}>
                  <td>#{e.row}</td>
                  <td>{e.vin ?? "—"}</td>
                  <td><code style={{ fontSize: 12 }}>{e.column ?? "—"}</code></td>
                  <td style={{ color: "#b92111" }}>{e.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="step-actions">
        <button type="button" className="btn btn--ghost" onClick={onReset}>Import Another File</button>
        <a href="/admin/inventory/" className="btn btn--primary">Go to Inventory →</a>
      </div>
    </div>
  );
}

// ── CSV parser (client-side, headers only) ────────────────────────────────────

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) { result.push(current); current = ""; }
    else current += ch;
  }
  result.push(current);
  return result;
}
