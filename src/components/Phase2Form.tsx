import { useState, useRef } from "react";
import type { Phase2FormData, ReferenceData } from "../lib/phase2-schema";

const PHONE_RE = /^[\d\s\-\+\(\)\.]+$/;

// ── Types ─────────────────────────────────────────────────────────────────────
interface UploadState {
  uploading: boolean;
  error: string | null;
  filename: string | null;
}

const DEFAULT_UPLOAD: UploadState = { uploading: false, error: null, filename: null };

interface Props {
  phase2Token: string;
  appId: string;
  applicantName: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const C = {
  red: "#B92111",
  ink: "#222732",
  muted: "#99a1b2",
  line: "#e4e7ec",
  bg: "#f7f9fd",
  white: "#ffffff",
  green: "#1a7f4b",
  dark: "#171818",
};

const inputBase: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "10px 12px",
  border: `1px solid ${C.line}`,
  borderRadius: "6px",
  fontSize: "15px",
  color: C.ink,
  background: C.white,
  boxSizing: "border-box",
  outline: "none",
  fontFamily: "inherit",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function FormField({
  label,
  required,
  error,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: C.ink, marginBottom: "5px" }}>
        {label}{required && <span style={{ color: C.red, marginLeft: "3px" }}>*</span>}
      </label>
      {hint && <p style={{ fontSize: "12px", color: C.muted, margin: "0 0 6px" }}>{hint}</p>}
      {children}
      {error && <p style={{ color: C.red, fontSize: "12px", marginTop: "4px" }}>{error}</p>}
    </div>
  );
}

function TextInput({ error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <input
      {...props}
      style={{ ...inputBase, borderColor: error ? C.red : C.line, ...props.style }}
    />
  );
}

function DocUploadField({
  label,
  hint,
  upload,
  onFile,
  onRemove,
  inputId,
  error,
}: {
  label: string;
  hint?: string;
  upload: UploadState;
  onFile: (file: File) => void;
  onRemove: () => void;
  inputId: string;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <FormField label={label} required hint={hint} error={upload.error ?? error}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/webp,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      {upload.filename ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", border: `1px solid ${C.green}`, borderRadius: "6px", background: "#f0fdf6" }}>
          <span style={{ color: C.green, fontSize: "16px" }}>✓</span>
          <span style={{ flex: 1, fontSize: "13px", color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{upload.filename}</span>
          <button type="button" onClick={onRemove} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "18px", padding: "0 2px", lineHeight: 1 }} title="Remove">×</button>
        </div>
      ) : upload.uploading ? (
        <div style={{ padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: "6px", fontSize: "13px", color: C.muted, background: C.bg }}>
          Uploading…
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{ display: "block", width: "100%", padding: "10px 12px", border: `1px dashed ${(upload.error ?? error) ? C.red : C.line}`, borderRadius: "6px", background: C.bg, color: C.muted, fontSize: "13px", cursor: "pointer", textAlign: "center", fontFamily: "inherit" }}
        >
          + Choose file (JPG, PNG, HEIC, PDF · max 50 MB)
        </button>
      )}
    </FormField>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Phase2Form({ phase2Token, appId, applicantName }: Props) {
  const [voidChequeUpload,    setVoidChequeUpload]    = useState<UploadState>(DEFAULT_UPLOAD);
  const [insuranceUpload,     setInsuranceUpload]     = useState<UploadState>(DEFAULT_UPLOAD);
  const [payslipUpload,       setPayslipUpload]       = useState<UploadState>(DEFAULT_UPLOAD);

  const [voidChequePath,      setVoidChequePath]      = useState("");
  const [proofInsurancePath,  setProofInsurancePath]  = useState("");
  const [payslipPath,         setPayslipPath]         = useState("");

  const [dealertrackConsent,  setDealertrackConsent]  = useState(false);

  const [references, setReferences] = useState<ReferenceData[]>([
    { name: "", phone: "", relationship: "" },
    { name: "", phone: "", relationship: "" },
  ]);

  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── File upload helper ─────────────────────────────────────────────────────
  const uploadDoc = async (
    docType: "void_cheque" | "proof_insurance" | "payslip",
    file: File,
    setUpload: React.Dispatch<React.SetStateAction<UploadState>>,
    setPath: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    setUpload({ uploading: true, error: null, filename: file.name });

    try {
      const res = await fetch("/api/finance/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase2Token, appId, docType, contentType: file.type, fileSize: file.size }),
      });

      if (!res.ok) {
        let msg = `Upload request failed (${res.status})`;
        try { msg = (await res.json()).error ?? msg; } catch { /* ignore */ }
        throw new Error(msg);
      }

      const { uploadUrl, storagePath } = await res.json();

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("Upload to storage failed");

      setPath(storagePath);
      setUpload({ uploading: false, error: null, filename: file.name });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUpload({ uploading: false, error: msg, filename: null });
      setPath("");
    }
  };

  // ── Reference field updater ────────────────────────────────────────────────
  const setRef = (idx: number, field: keyof ReferenceData, value: string) => {
    setReferences((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    // Client-side guards
    const newErrors: Record<string, string> = {};
    if (!voidChequePath)     newErrors.voidChequePath     = "Please upload your void cheque";
    if (!proofInsurancePath) newErrors.proofInsurancePath = "Please upload proof of insurance";
    if (!payslipPath)        newErrors.payslipPath        = "Please upload your most recent payslip";
    if (!dealertrackConsent) newErrors.dealertrackConsent = "You must consent to the credit bureau check";
    references.forEach((r, i) => {
      if (!r.name)         newErrors[`references.${i}.name`]         = "Name is required";
      if (!r.phone) {
        newErrors[`references.${i}.phone`]        = "Phone is required";
      } else if (r.phone.trim().replace(/\D/g, "").length < 10) {
        newErrors[`references.${i}.phone`] = "Phone number must be at least 10 digits";
      } else if (!PHONE_RE.test(r.phone)) {
        newErrors[`references.${i}.phone`] = "Phone must contain only digits, spaces, hyphens, parentheses, and plus signs";
      }
      if (!r.relationship) newErrors[`references.${i}.relationship`] = "Relationship is required";
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/finance/phase2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase2Token, appId, voidChequePath, proofInsurancePath, payslipPath, dealertrackConsent, references }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.errors) {
          setErrors(data.errors);
        } else {
          setSubmitError(data.error ?? `Submission failed (${res.status})`);
        }
        return;
      }

      setSubmitted(true);
    } catch {
      setSubmitError("Network error — please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ maxWidth: "560px", margin: "60px auto", textAlign: "center", padding: "0 20px" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: C.dark, marginBottom: "8px" }}>Documents Submitted</h1>
        <p style={{ color: C.muted, lineHeight: 1.6 }}>
          Thank you, {applicantName}. Your documents have been received and your application is now under review. We'll be in touch shortly.
        </p>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: "620px", margin: "0 auto", padding: "0 20px 60px" }}>
      <h1 style={{ fontSize: "22px", fontWeight: 800, color: C.dark, marginBottom: "4px" }}>
        Complete Your Application
      </h1>
      <p style={{ color: C.muted, fontSize: "14px", marginBottom: "32px", lineHeight: 1.5 }}>
        Hi {applicantName}, please upload the required documents and provide two personal references to finalize your financing application.
      </p>

      {/* ── Documents ─────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "13px", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "16px" }}>
          Required Documents
        </h2>

        <DocUploadField
          label="Void Cheque"
          hint="A voided cheque from your bank account for direct deposit setup."
          upload={voidChequeUpload}
          onFile={(f) => uploadDoc("void_cheque", f, setVoidChequeUpload, setVoidChequePath)}
          onRemove={() => { setVoidChequeUpload(DEFAULT_UPLOAD); setVoidChequePath(""); }}
          inputId="void-cheque"
          error={errors.voidChequePath}
        />
        <DocUploadField
          label="Proof of Insurance"
          hint="Current vehicle insurance certificate or policy document."
          upload={insuranceUpload}
          onFile={(f) => uploadDoc("proof_insurance", f, setInsuranceUpload, setProofInsurancePath)}
          onRemove={() => { setInsuranceUpload(DEFAULT_UPLOAD); setProofInsurancePath(""); }}
          inputId="proof-insurance"
          error={errors.proofInsurancePath}
        />
        <DocUploadField
          label="Most Recent Payslip"
          hint="Your latest pay stub or proof of income."
          upload={payslipUpload}
          onFile={(f) => uploadDoc("payslip", f, setPayslipUpload, setPayslipPath)}
          onRemove={() => { setPayslipUpload(DEFAULT_UPLOAD); setPayslipPath(""); }}
          inputId="payslip"
          error={errors.payslipPath}
        />
      </section>

      {/* ── References ────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "13px", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "16px" }}>
          Personal References
        </h2>
        <p style={{ fontSize: "13px", color: C.muted, marginBottom: "20px", lineHeight: 1.5 }}>
          Please provide two personal references (not family members).
        </p>

        {references.map((ref, i) => (
          <div key={i} style={{ padding: "16px", border: `1px solid ${C.line}`, borderRadius: "8px", marginBottom: "16px" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: C.ink, marginBottom: "14px" }}>Reference {i + 1}</p>
            <FormField label="Full Name" required error={errors[`references.${i}.name`]}>
              <TextInput
                type="text"
                value={ref.name}
                onChange={(e) => setRef(i, "name", e.target.value)}
                placeholder="Jane Smith"
                error={errors[`references.${i}.name`]}
              />
            </FormField>
            <FormField label="Phone Number" required error={errors[`references.${i}.phone`]}>
              <TextInput
                type="tel"
                value={ref.phone}
                onChange={(e) => setRef(i, "phone", e.target.value)}
                placeholder="(416) 555-0100"
                error={errors[`references.${i}.phone`]}
              />
            </FormField>
            <FormField label="Relationship" required error={errors[`references.${i}.relationship`]}>
              <TextInput
                type="text"
                value={ref.relationship}
                onChange={(e) => setRef(i, "relationship", e.target.value)}
                placeholder="Friend, Colleague, Neighbour…"
                error={errors[`references.${i}.relationship`]}
              />
            </FormField>
          </div>
        ))}
      </section>

      {/* ── DealerTrack consent ────────────────────────────────────────────── */}
      <section style={{ marginBottom: "32px" }}>
        <div
          style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "16px", border: `1px solid ${errors.dealertrackConsent ? C.red : C.line}`, borderRadius: "8px", background: C.bg, cursor: "pointer" }}
          onClick={() => setDealertrackConsent((v) => !v)}
        >
          <input
            id="dealertrack-consent"
            type="checkbox"
            checked={dealertrackConsent}
            onChange={(e) => setDealertrackConsent(e.target.checked)}
            style={{ marginTop: "2px", accentColor: C.red, width: "16px", height: "16px", flexShrink: 0, cursor: "pointer" }}
            onClick={(e) => e.stopPropagation()}
          />
          <label htmlFor="dealertrack-consent" style={{ fontSize: "13px", color: C.ink, lineHeight: 1.55, cursor: "pointer" }}>
            I consent to Alfursan Auto submitting my information to DealerTrack for a credit bureau check as part of my financing application. I understand this may result in a credit inquiry.
          </label>
        </div>
        {errors.dealertrackConsent && (
          <p style={{ color: C.red, fontSize: "12px", marginTop: "6px" }}>{errors.dealertrackConsent}</p>
        )}
      </section>

      {/* ── Submit ─────────────────────────────────────────────────────────── */}
      {submitError && (
        <div style={{ padding: "12px 16px", background: "#fff5f5", border: `1px solid #fca5a5`, borderRadius: "8px", marginBottom: "16px", color: C.red, fontSize: "14px" }}>
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{ display: "block", width: "100%", padding: "14px", background: C.red, color: "#fff", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: 700, fontFamily: "inherit", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}
      >
        {submitting ? "Submitting…" : "Submit Documents"}
      </button>
    </form>
  );
}
