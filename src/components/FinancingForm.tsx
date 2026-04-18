import React, { useState, useEffect, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type FormData = {
  // Step 1
  fullName: string;
  dob: string;
  address: string;
  postalCode: string;
  timeAtAddress: string;
  prevAddress: string;
  phone: string;
  email: string;
  maritalStatus: string;
  // Step 2
  employmentStatus: string;
  employer: string;
  jobTitle: string;
  annualIncome: string;
  timeAtEmployer: string;
  prevEmployer: string;
  prevTimeAtEmployer: string;
  // Step 3
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehiclePrice: string;
  downPayment: string;
  loanTermMonths: string;
  vin: string;
  listingSlug: string;
  draftId: string;
  licenseFrontPath: string;
  licenseBackPath: string;
  // Step 4
  consentAccurate: boolean;
  consentPrivacy: boolean;
  licenseConsent: boolean;
};

type UploadState = {
  uploading: boolean;
  error: string | null;
  filename: string | null;
};

type Errors = Record<string, string>;

// ── Constants ─────────────────────────────────────────────────────────────────
const DRAFT_KEY = "alfursan:financing:draft";

const STEPS = ["Personal", "Employment", "Vehicle & Loan", "Review & Submit"];

const TIME_OPTIONS = ["< 1 year", "1–2 years", "2–5 years", "5+ years"];

const LOAN_TERMS = ["24", "36", "48", "60", "72", "84"];

const EMPLOYMENT_OPTIONS = [
  { value: "", label: "Select employment status" },
  { value: "full-time", label: "Full-time employed" },
  { value: "part-time", label: "Part-time employed" },
  { value: "self-employed", label: "Self-employed" },
  { value: "retired", label: "Retired" },
  { value: "other", label: "Other" },
];

const MARITAL_OPTIONS = [
  { value: "", label: "Select (optional)" },
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "common-law", label: "Common-law" },
  { value: "divorced", label: "Divorced" },
  { value: "widowed", label: "Widowed" },
  { value: "separated", label: "Separated" },
];

const DEFAULT_DATA: FormData = {
  fullName: "",
  dob: "",
  address: "",
  postalCode: "",
  timeAtAddress: "",
  prevAddress: "",
  phone: "",
  email: "",
  maritalStatus: "",
  employmentStatus: "",
  employer: "",
  jobTitle: "",
  annualIncome: "",
  timeAtEmployer: "",
  prevEmployer: "",
  prevTimeAtEmployer: "",
  vehicleYear: "",
  vehicleMake: "",
  vehicleModel: "",
  vehiclePrice: "",
  downPayment: "",
  loanTermMonths: "",
  vin: "",
  listingSlug: "",
  draftId: "",
  licenseFrontPath: "",
  licenseBackPath: "",
  consentAccurate: false,
  consentPrivacy: false,
  licenseConsent: false,
};

const DEFAULT_UPLOAD: UploadState = {
  uploading: false,
  error: null,
  filename: null,
};

// ── Styles ────────────────────────────────────────────────────────────────────
const C = {
  red: "#B92111",
  ink: "#222732",
  muted: "#99a1b2",
  line: "#e4e7ec",
  bg: "#f7f9fd",
  white: "#ffffff",
  green: "#1a7f4b",
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

// ── Primitive UI helpers ──────────────────────────────────────────────────────
function FormField({
  label,
  required,
  error,
  children,
  style,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ marginBottom: "16px", ...style }}>
      <label
        style={{
          display: "block",
          fontSize: "13px",
          fontWeight: 600,
          color: C.ink,
          marginBottom: "5px",
          letterSpacing: "0.01em",
        }}
      >
        {label}
        {required && (
          <span style={{ color: C.red, marginLeft: "3px" }}>*</span>
        )}
      </label>
      {children}
      {error && (
        <p
          style={{
            color: C.red,
            fontSize: "12px",
            marginTop: "4px",
            margin: "4px 0 0",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function TextInput({
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <input
      {...props}
      style={{
        ...inputBase,
        borderColor: error ? C.red : C.line,
        ...props.style,
      }}
    />
  );
}

function SelectInput({
  error,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <select
      {...props}
      style={{
        ...inputBase,
        borderColor: error ? C.red : C.line,
        cursor: "pointer",
        ...props.style,
      }}
    >
      {children}
    </select>
  );
}

function Row({
  children,
  cols = 2,
}: {
  children: React.ReactNode;
  cols?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: "0 16px",
      }}
    >
      {children}
    </div>
  );
}

// ── Progress stepper ──────────────────────────────────────────────────────────
function ProgressStepper({ current }: { current: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: "32px",
        gap: 0,
      }}
    >
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <React.Fragment key={n}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  fontWeight: 700,
                  background: done ? C.green : active ? C.red : C.bg,
                  color: done || active ? C.white : C.muted,
                  border: `2px solid ${done ? C.green : active ? C.red : C.line}`,
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
              >
                {done ? "✓" : n}
              </div>
              <span
                style={{
                  fontSize: "11px",
                  marginTop: "4px",
                  color: active ? C.red : done ? C.green : C.muted,
                  fontWeight: active ? 600 : 400,
                  textAlign: "center",
                  lineHeight: "1.2",
                  display: "none", // hide labels on mobile to save space; shown via media query below
                }}
                className="step-label"
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: "2px",
                  background: done ? C.green : C.line,
                  marginBottom: "18px",
                  transition: "background 0.2s",
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Step 1 — Personal Information ─────────────────────────────────────────────
function Step1Personal({
  data,
  set,
  errors,
}: {
  data: FormData;
  set: (f: keyof FormData, v: string | boolean) => void;
  errors: Errors;
}) {
  const needPrev = ["< 1 year", "1–2 years"].includes(data.timeAtAddress);
  return (
    <div>
      <h2 style={{ fontSize: "20px", fontWeight: 700, color: C.ink, marginBottom: "4px" }}>
        Personal Information
      </h2>
      <p style={{ color: C.muted, fontSize: "14px", marginBottom: "24px" }}>
        Tell us a bit about yourself.
      </p>

      <Row>
        <FormField label="Full Legal Name" required error={errors.fullName}>
          <TextInput
            type="text"
            value={data.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            placeholder="As it appears on your ID"
            error={errors.fullName}
            autoComplete="name"
          />
        </FormField>
        <FormField label="Date of Birth" required error={errors.dob}>
          <TextInput
            type="date"
            value={data.dob}
            onChange={(e) => set("dob", e.target.value)}
            error={errors.dob}
            autoComplete="bday"
          />
        </FormField>
      </Row>

      <FormField label="Current Address" required error={errors.address}>
        <TextInput
          type="text"
          value={data.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="Street address, city, province"
          error={errors.address}
          autoComplete="street-address"
        />
      </FormField>

      <Row>
        <FormField label="Postal Code" required error={errors.postalCode}>
          <TextInput
            type="text"
            value={data.postalCode}
            onChange={(e) => set("postalCode", e.target.value.toUpperCase())}
            placeholder="M5V 3A8"
            error={errors.postalCode}
            maxLength={7}
            autoComplete="postal-code"
          />
        </FormField>
        <FormField label="Time at Current Address" required error={errors.timeAtAddress}>
          <SelectInput
            value={data.timeAtAddress}
            onChange={(e) => set("timeAtAddress", e.target.value)}
            error={errors.timeAtAddress}
          >
            <option value="">Select…</option>
            {TIME_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </SelectInput>
        </FormField>
      </Row>

      {needPrev && (
        <FormField label="Previous Address">
          <TextInput
            type="text"
            value={data.prevAddress}
            onChange={(e) => set("prevAddress", e.target.value)}
            placeholder="Previous address (if < 2 years at current)"
          />
        </FormField>
      )}

      <Row>
        <FormField label="Phone Number" required error={errors.phone}>
          <TextInput
            type="tel"
            value={data.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+1 (416) 555-0100"
            error={errors.phone}
            autoComplete="tel"
          />
        </FormField>
        <FormField label="Email Address" required error={errors.email}>
          <TextInput
            type="email"
            value={data.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@example.com"
            error={errors.email}
            autoComplete="email"
          />
        </FormField>
      </Row>

      <FormField label="Marital Status">
        <SelectInput
          value={data.maritalStatus}
          onChange={(e) => set("maritalStatus", e.target.value)}
        >
          {MARITAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectInput>
      </FormField>
    </div>
  );
}

// ── Step 2 — Employment ───────────────────────────────────────────────────────
function Step2Employment({
  data,
  set,
  errors,
}: {
  data: FormData;
  set: (f: keyof FormData, v: string | boolean) => void;
  errors: Errors;
}) {
  const needPrev = ["< 1 year", "1–2 years"].includes(data.timeAtEmployer);
  const isEmployed = ["full-time", "part-time", "self-employed"].includes(
    data.employmentStatus
  );

  return (
    <div>
      <h2 style={{ fontSize: "20px", fontWeight: 700, color: C.ink, marginBottom: "4px" }}>
        Employment
      </h2>
      <p style={{ color: C.muted, fontSize: "14px", marginBottom: "24px" }}>
        We use this to assess your financing eligibility.
      </p>

      <FormField label="Employment Status" required error={errors.employmentStatus}>
        <SelectInput
          value={data.employmentStatus}
          onChange={(e) => set("employmentStatus", e.target.value)}
          error={errors.employmentStatus}
        >
          {EMPLOYMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectInput>
      </FormField>

      {isEmployed && (
        <>
          <Row>
            <FormField label="Employer / Company Name">
              <TextInput
                type="text"
                value={data.employer}
                onChange={(e) => set("employer", e.target.value)}
                placeholder="Company name"
              />
            </FormField>
            <FormField label="Job Title / Position">
              <TextInput
                type="text"
                value={data.jobTitle}
                onChange={(e) => set("jobTitle", e.target.value)}
                placeholder="Your role"
              />
            </FormField>
          </Row>

          <Row>
            <FormField label="Gross Annual Income (CAD)">
              <TextInput
                type="number"
                value={data.annualIncome}
                onChange={(e) => set("annualIncome", e.target.value)}
                placeholder="e.g. 55000"
                min="0"
                step="1000"
              />
            </FormField>
            <FormField label="Time at Current Employer">
              <SelectInput
                value={data.timeAtEmployer}
                onChange={(e) => set("timeAtEmployer", e.target.value)}
              >
                <option value="">Select…</option>
                {TIME_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </SelectInput>
            </FormField>
          </Row>

          {needPrev && (
            <Row>
              <FormField label="Previous Employer">
                <TextInput
                  type="text"
                  value={data.prevEmployer}
                  onChange={(e) => set("prevEmployer", e.target.value)}
                  placeholder="Previous company name"
                />
              </FormField>
              <FormField label="Time at Previous Employer">
                <SelectInput
                  value={data.prevTimeAtEmployer}
                  onChange={(e) => set("prevTimeAtEmployer", e.target.value)}
                >
                  <option value="">Select…</option>
                  {TIME_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
            </Row>
          )}
        </>
      )}
    </div>
  );
}

// ── File upload button ────────────────────────────────────────────────────────
function LicenseUploadField({
  label,
  upload,
  onFile,
  onRemove,
  inputId,
}: {
  label: string;
  upload: UploadState;
  onFile: (file: File) => void;
  onRemove: () => void;
  inputId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <FormField label={label}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/webp,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = ""; // reset so same file can be re-selected
        }}
      />
      {upload.filename ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 12px",
            border: `1px solid ${C.green}`,
            borderRadius: "6px",
            background: "#f0fdf6",
          }}
        >
          <span style={{ color: C.green, fontSize: "16px" }}>✓</span>
          <span
            style={{
              flex: 1,
              fontSize: "13px",
              color: C.ink,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {upload.filename}
          </span>
          <button
            type="button"
            onClick={onRemove}
            style={{
              background: "none",
              border: "none",
              color: C.muted,
              cursor: "pointer",
              fontSize: "16px",
              padding: "0 2px",
              lineHeight: 1,
            }}
            title="Remove file"
          >
            ×
          </button>
        </div>
      ) : upload.uploading ? (
        <div
          style={{
            padding: "10px 12px",
            border: `1px solid ${C.line}`,
            borderRadius: "6px",
            fontSize: "13px",
            color: C.muted,
            background: C.bg,
          }}
        >
          Uploading…
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            display: "block",
            width: "100%",
            padding: "10px 12px",
            border: `1px dashed ${upload.error ? C.red : C.line}`,
            borderRadius: "6px",
            background: C.bg,
            color: C.muted,
            fontSize: "13px",
            cursor: "pointer",
            textAlign: "center",
            fontFamily: "inherit",
          }}
        >
          + Choose file (JPG, PNG, HEIC, PDF · max 8 MB)
        </button>
      )}
      {upload.error && (
        <p style={{ color: C.red, fontSize: "12px", marginTop: "4px" }}>
          {upload.error}
        </p>
      )}
    </FormField>
  );
}

// ── Step 3 — Vehicle & Loan ───────────────────────────────────────────────────
function Step3Vehicle({
  data,
  set,
  errors: _errors,
  frontUpload,
  backUpload,
  onUpload,
  onRemoveFile,
}: {
  data: FormData;
  set: (f: keyof FormData, v: string | boolean) => void;
  errors: Errors;
  frontUpload: UploadState;
  backUpload: UploadState;
  onUpload: (side: "front" | "back", file: File) => void;
  onRemoveFile: (side: "front" | "back") => void;
}) {
  return (
    <div>
      <h2 style={{ fontSize: "20px", fontWeight: 700, color: C.ink, marginBottom: "4px" }}>
        Vehicle & Loan
      </h2>
      <p style={{ color: C.muted, fontSize: "14px", marginBottom: "24px" }}>
        Tell us about the vehicle and how you'd like to finance it. All fields
        are optional.
      </p>

      <Row cols={3}>
        <FormField label="Vehicle Year">
          <TextInput
            type="text"
            value={data.vehicleYear}
            onChange={(e) => set("vehicleYear", e.target.value)}
            placeholder="2021"
            maxLength={4}
          />
        </FormField>
        <FormField label="Make">
          <TextInput
            type="text"
            value={data.vehicleMake}
            onChange={(e) => set("vehicleMake", e.target.value)}
            placeholder="Honda"
          />
        </FormField>
        <FormField label="Model">
          <TextInput
            type="text"
            value={data.vehicleModel}
            onChange={(e) => set("vehicleModel", e.target.value)}
            placeholder="Civic"
          />
        </FormField>
      </Row>

      <Row>
        <FormField label="Vehicle Price (CAD)">
          <TextInput
            type="number"
            value={data.vehiclePrice}
            onChange={(e) => set("vehiclePrice", e.target.value)}
            placeholder="e.g. 22000"
            min="0"
            step="500"
          />
        </FormField>
        <FormField label="Down Payment (CAD)">
          <TextInput
            type="number"
            value={data.downPayment}
            onChange={(e) => set("downPayment", e.target.value)}
            placeholder="e.g. 3000"
            min="0"
            step="500"
          />
        </FormField>
      </Row>

      <Row>
        <FormField label="Preferred Loan Term">
          <SelectInput
            value={data.loanTermMonths}
            onChange={(e) => set("loanTermMonths", e.target.value)}
          >
            <option value="">Select (optional)</option>
            {LOAN_TERMS.map((t) => (
              <option key={t} value={t}>
                {t} months
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField label="VIN (if known)">
          <TextInput
            type="text"
            value={data.vin}
            onChange={(e) => set("vin", e.target.value.toUpperCase())}
            placeholder="17-character VIN"
            maxLength={17}
          />
        </FormField>
      </Row>

      <div
        style={{
          borderTop: `1px solid ${C.line}`,
          paddingTop: "20px",
          marginTop: "4px",
        }}
      >
        <p
          style={{
            fontSize: "13px",
            color: C.muted,
            marginBottom: "16px",
            lineHeight: "1.5",
          }}
        >
          <strong style={{ color: C.ink }}>Driver's License (optional)</strong>
          {" — "}
          Uploading a copy speeds up processing. Files are stored in an
          encrypted private bucket and never shared with third parties.
        </p>
        <Row>
          <LicenseUploadField
            label="License — Front"
            upload={frontUpload}
            onFile={(f) => onUpload("front", f)}
            onRemove={() => onRemoveFile("front")}
            inputId="license-front"
          />
          <LicenseUploadField
            label="License — Back"
            upload={backUpload}
            onFile={(f) => onUpload("back", f)}
            onRemove={() => onRemoveFile("back")}
            inputId="license-back"
          />
        </Row>
      </div>
    </div>
  );
}

// ── Step 4 — Review & Consent ─────────────────────────────────────────────────
function Step4Review({
  data,
  set,
  errors,
}: {
  data: FormData;
  set: (f: keyof FormData, v: string | boolean) => void;
  errors: Errors;
}) {
  const hasLicense = !!(data.licenseFrontPath || data.licenseBackPath);

  const summaryItems: [string, string][] = [
    ["Name", data.fullName],
    ["Email", data.email],
    ["Phone", data.phone],
    ["Employment", data.employmentStatus],
    [
      "Vehicle",
      [data.vehicleYear, data.vehicleMake, data.vehicleModel]
        .filter(Boolean)
        .join(" ") || "—",
    ],
  ];

  return (
    <div>
      <h2 style={{ fontSize: "20px", fontWeight: 700, color: C.ink, marginBottom: "4px" }}>
        Review & Submit
      </h2>
      <p style={{ color: C.muted, fontSize: "14px", marginBottom: "24px" }}>
        Please review your information and provide consent before submitting.
      </p>

      {/* Summary card */}
      <div
        style={{
          background: C.bg,
          border: `1px solid ${C.line}`,
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "24px",
        }}
      >
        <p
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: C.muted,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: "10px",
          }}
        >
          Application Summary
        </p>
        {summaryItems.map(([k, v]) => (
          <div
            key={k}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "14px",
              padding: "4px 0",
              borderBottom: `1px solid ${C.line}`,
            }}
          >
            <span style={{ color: C.muted }}>{k}</span>
            <span style={{ color: C.ink, fontWeight: 500 }}>{v || "—"}</span>
          </div>
        ))}
      </div>

      {/* Consent checkboxes */}
      <ConsentBox
        id="consent-accurate"
        checked={data.consentAccurate}
        onChange={(v) => set("consentAccurate", v)}
        error={errors.consentAccurate}
      >
        I confirm that all information I have provided is true and accurate to
        the best of my knowledge.
      </ConsentBox>

      <ConsentBox
        id="consent-privacy"
        checked={data.consentPrivacy}
        onChange={(v) => set("consentPrivacy", v)}
        error={errors.consentPrivacy}
      >
        I have read and accept the{" "}
        <a
          href="/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: C.red }}
        >
          Privacy Policy
        </a>
        , and I consent to Alfursan Auto collecting and retaining my personal
        information for the purpose of evaluating my financing application.
      </ConsentBox>

      {hasLicense && (
        <ConsentBox
          id="consent-license"
          checked={data.licenseConsent}
          onChange={(v) => set("licenseConsent", v)}
        >
          I authorize Alfursan Auto to collect and retain a copy of my driver's
          license for identity verification purposes.
        </ConsentBox>
      )}
    </div>
  );
}

function ConsentBox({
  id,
  checked,
  onChange,
  error,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label
        htmlFor={id}
        style={{
          display: "flex",
          gap: "12px",
          cursor: "pointer",
          alignItems: "flex-start",
        }}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{
            width: "18px",
            height: "18px",
            flexShrink: 0,
            marginTop: "1px",
            accentColor: C.red,
            cursor: "pointer",
          }}
        />
        <span style={{ fontSize: "14px", color: C.ink, lineHeight: "1.5" }}>
          {children}
        </span>
      </label>
      {error && (
        <p style={{ color: C.red, fontSize: "12px", marginTop: "4px" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────
function SuccessView({ applicationId }: { applicationId: string }) {
  return (
    <div style={{ textAlign: "center", padding: "24px 0" }}>
      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          background: "#f0fdf6",
          border: `2px solid ${C.green}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          fontSize: "28px",
        }}
      >
        ✓
      </div>
      <h2
        style={{
          fontSize: "22px",
          fontWeight: 700,
          color: C.ink,
          marginBottom: "8px",
        }}
      >
        Application Submitted!
      </h2>
      <p style={{ color: C.muted, fontSize: "15px", marginBottom: "20px" }}>
        We've received your financing application and will be in touch shortly.
      </p>
      <div
        style={{
          background: C.bg,
          border: `1px solid ${C.line}`,
          borderRadius: "8px",
          padding: "12px 20px",
          display: "inline-block",
          marginBottom: "28px",
        }}
      >
        <span style={{ fontSize: "12px", color: C.muted, display: "block" }}>
          Reference Number
        </span>
        <span
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: C.ink,
            fontFamily: "monospace",
          }}
        >
          {applicationId}
        </span>
      </div>
      <p style={{ fontSize: "13px", color: C.muted }}>
        Save your reference number for follow-up inquiries.
        <br />
        You can also reach us at{" "}
        <a href="tel:+14168384007" style={{ color: C.red }}>
          +1 (416) 838-4007
        </a>
        .
      </p>
    </div>
  );
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateStep(step: number, data: FormData): Errors {
  const e: Errors = {};
  if (step === 1) {
    if (!data.fullName.trim()) e.fullName = "Full name is required";
    if (!data.dob) e.dob = "Date of birth is required";
    if (!data.address.trim()) e.address = "Address is required";
    if (!data.postalCode.trim()) e.postalCode = "Postal code is required";
    else if (!/^[A-Za-z]\d[A-Za-z][ ]?\d[A-Za-z]\d$/.test(data.postalCode))
      e.postalCode = "Enter a valid Canadian postal code (e.g. M5V 3A8)";
    if (!data.timeAtAddress) e.timeAtAddress = "Required";
    if (!data.phone.trim()) e.phone = "Phone number is required";
    if (!data.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
      e.email = "Enter a valid email address";
  }
  if (step === 2) {
    if (!data.employmentStatus) e.employmentStatus = "Required";
  }
  if (step === 4) {
    if (!data.consentAccurate)
      e.consentAccurate = "You must confirm the information is accurate";
    if (!data.consentPrivacy)
      e.consentPrivacy = "You must accept the Privacy Policy";
  }
  return e;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FinancingForm() {
  const [formData, setFormData] = useState<FormData>(DEFAULT_DATA);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Errors>({});
  const [frontUpload, setFrontUpload] = useState<UploadState>(DEFAULT_UPLOAD);
  const [backUpload, setBackUpload] = useState<UploadState>(DEFAULT_UPLOAD);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [submitError, setSubmitError] = useState("");
  const topRef = useRef<HTMLDivElement>(null);

  // Restore draft + apply URL params on mount
  useEffect(() => {
    let restored: Partial<FormData> = {};
    let restoredStep = 1;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        restored = saved.data ?? {};
        restoredStep = saved.step ?? 1;
      }
    } catch { /* ignore */ }

    // URL params override vehicle fields
    const params = new URLSearchParams(window.location.search);
    const urlOverrides: Partial<FormData> = {};
    const slug = params.get("slug");
    const year = params.get("year");
    const make = params.get("make");
    const model = params.get("model");
    const price = params.get("price");
    if (slug) urlOverrides.listingSlug = slug;
    if (year) urlOverrides.vehicleYear = year;
    if (make) urlOverrides.vehicleMake = make;
    if (model) urlOverrides.vehicleModel = model;
    if (price) urlOverrides.vehiclePrice = price;

    setFormData((prev) => ({
      ...prev,
      ...restored,
      ...urlOverrides,
      draftId:
        (restored.draftId as string | undefined) || crypto.randomUUID(),
    }));
    setStep(restoredStep);
  }, []);

  // Persist draft on every change
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ data: formData, step }));
    } catch { /* ignore */ }
  }, [formData, step]);

  const set = useCallback((field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const scrollTop = () =>
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const handleNext = () => {
    const errs = validateStep(step, formData);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setStep((s) => s + 1);
    scrollTop();
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => s - 1);
    scrollTop();
  };

  const handleUpload = async (side: "front" | "back", file: File) => {
    const setUpload = side === "front" ? setFrontUpload : setBackUpload;
    setUpload({ uploading: true, error: null, filename: file.name });

    try {
      const res = await fetch("/api/financing/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: formData.draftId,
          side,
          contentType: file.type,
          fileSize: file.size,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload request failed");
      }

      const { uploadUrl, storagePath } = await res.json();

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!put.ok) throw new Error("Upload to storage failed");

      set(side === "front" ? "licenseFrontPath" : "licenseBackPath", storagePath);
      setUpload({ uploading: false, error: null, filename: file.name });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUpload({ uploading: false, error: msg, filename: null });
      set(side === "front" ? "licenseFrontPath" : "licenseBackPath", "");
    }
  };

  const handleRemoveFile = (side: "front" | "back") => {
    const setUpload = side === "front" ? setFrontUpload : setBackUpload;
    setUpload(DEFAULT_UPLOAD);
    set(side === "front" ? "licenseFrontPath" : "licenseBackPath", "");
  };

  const handleSubmit = async () => {
    const errs = validateStep(4, formData);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/financing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const payload = await res.json();

      if (res.status === 429) {
        setSubmitError(
          "Too many submissions from your connection. Please try again in an hour."
        );
        return;
      }

      if (!res.ok || !payload.success) {
        if (payload.errors) {
          setErrors(payload.errors);
        }
        setSubmitError(
          payload.error || "Something went wrong. Please try again."
        );
        return;
      }

      // Success
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch { /* ignore */ }
      setApplicationId(payload.applicationId);
      setSubmitted(true);
      scrollTop();
    } catch {
      setSubmitError("Network error. Please check your connection and retry.");
    } finally {
      setSubmitting(false);
    }
  };

  const btnBase: React.CSSProperties = {
    padding: "12px 24px",
    borderRadius: "6px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    fontFamily: "inherit",
    transition: "opacity 0.15s",
  };

  return (
    <>
      {/* Step label visibility: shown on wider screens */}
      <style>{`.step-label { display: none } @media(min-width:500px){ .step-label { display: block } }`}</style>

      <div
        ref={topRef}
        style={{
          background: C.white,
          border: `1px solid ${C.line}`,
          borderRadius: "12px",
          padding: "clamp(20px, 5vw, 36px)",
          maxWidth: "680px",
          width: "100%",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      >
        {submitted ? (
          <SuccessView applicationId={applicationId} />
        ) : (
          <>
            <ProgressStepper current={step} />

            <form
              onSubmit={(e) => e.preventDefault()}
              noValidate
            >
              {step === 1 && (
                <Step1Personal data={formData} set={set} errors={errors} />
              )}
              {step === 2 && (
                <Step2Employment data={formData} set={set} errors={errors} />
              )}
              {step === 3 && (
                <Step3Vehicle
                  data={formData}
                  set={set}
                  errors={errors}
                  frontUpload={frontUpload}
                  backUpload={backUpload}
                  onUpload={handleUpload}
                  onRemoveFile={handleRemoveFile}
                />
              )}
              {step === 4 && (
                <Step4Review data={formData} set={set} errors={errors} />
              )}

              {/* Navigation */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "28px",
                  paddingTop: "20px",
                  borderTop: `1px solid ${C.line}`,
                  gap: "12px",
                }}
              >
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    style={{
                      ...btnBase,
                      background: "none",
                      border: `1px solid ${C.line}`,
                      color: C.ink,
                    }}
                  >
                    ← Back
                  </button>
                ) : (
                  <span />
                )}

                {submitError && (
                  <p
                    style={{
                      color: C.red,
                      fontSize: "13px",
                      flex: 1,
                      textAlign: "center",
                      margin: 0,
                    }}
                  >
                    {submitError}
                  </p>
                )}

                {step < 4 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    style={{
                      ...btnBase,
                      background: C.red,
                      color: C.white,
                      marginLeft: "auto",
                    }}
                  >
                    Continue →
                  </button>
                ) : (
                  <button
                    type="submit"
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{
                      ...btnBase,
                      background: C.red,
                      color: C.white,
                      marginLeft: "auto",
                      opacity: submitting ? 0.7 : 1,
                      cursor: submitting ? "not-allowed" : "pointer",
                    }}
                  >
                    {submitting ? "Submitting…" : "Submit Application"}
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </>
  );
}
