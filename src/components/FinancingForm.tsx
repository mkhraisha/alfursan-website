import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  type PrevAddress,
  type PrevEmployer,
  type FormData,
  type Errors,
  stripCommas,
  monthsSince,
  validateStep,
} from "../lib/form-utils";

type UploadState = {
  uploading: boolean;
  error: string | null;
  filename: string | null;
};

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

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];


const DEFAULT_DATA: FormData = {
  fullName: "",
  dob: "",
  address: "",
  postalCode: "",
  addressSinceYear: "",
  addressSinceMonth: "",
  prevAddresses: [],
  phone: "",
  email: "",
  maritalStatus: "",
  employmentStatus: "",
  employer: "",
  employerAddress: "",
  employerPhone: "",
  jobTitle: "",
  annualIncome: "",
  employerSinceYear: "",
  employerSinceMonth: "",
  prevEmployers: [],
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
  setData,
  errors,
}: {
  data: FormData;
  set: (f: keyof FormData, v: string | boolean) => void;
  setData: React.Dispatch<React.SetStateAction<FormData>>;
  errors: Errors;
}) {
  const needPrev = monthsSince(data.addressSinceYear, data.addressSinceMonth) < 24;

  const addAddress = () =>
    setData((prev) => ({
      ...prev,
      prevAddresses: [...prev.prevAddresses, { address: "", postalCode: "", sinceYear: "", sinceMonth: "" }],
    }));

  const removeAddress = (i: number) =>
    setData((prev) => ({
      ...prev,
      prevAddresses: prev.prevAddresses.filter((_, idx) => idx !== i),
    }));

  const updateAddress = (i: number, field: keyof PrevAddress, value: string) =>
    setData((prev) => {
      const updated = [...prev.prevAddresses];
      updated[i] = { ...updated[i], [field]: value };
      return { ...prev, prevAddresses: updated };
    });

  const oldestPrevMonths =
    data.prevAddresses.length > 0
      ? monthsSince(
          data.prevAddresses[data.prevAddresses.length - 1].sinceYear,
          data.prevAddresses[data.prevAddresses.length - 1].sinceMonth
        )
      : 0;
  const needMoreAddresses = needPrev && oldestPrevMonths < 24;
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
        <FormField label="Living at Current Address Since" required error={errors.addressSinceYear || errors.addressSinceMonth}>
          <Row>
            <SelectInput
              value={data.addressSinceMonth}
              onChange={(e) => set("addressSinceMonth", e.target.value)}
              error={errors.addressSinceMonth}
            >
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={i} value={String(i + 1)}>{m}</option>
              ))}
            </SelectInput>
            <TextInput
              type="number"
              value={data.addressSinceYear}
              onChange={(e) => set("addressSinceYear", e.target.value)}
              placeholder="Year (e.g. 2020)"
              min="1950"
              max={String(new Date().getFullYear())}
              error={errors.addressSinceYear}
            />
          </Row>
        </FormField>
      </Row>

      {needPrev && (
        <div style={{ marginTop: "8px" }}>
          <p style={{ fontSize: "13px", color: C.muted, marginBottom: "12px" }}>
            You've been at your current address for less than 2 years. Please add previous addresses going back at least 2 years total.
          </p>

          {data.prevAddresses.map((entry, i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${C.line}`,
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "12px",
                background: C.bg,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: C.ink }}>
                  Previous Address {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeAddress(i)}
                  style={{ fontSize: "12px", color: C.red, background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
                >
                  Remove
                </button>
              </div>
              <FormField label="Address" required error={errors[`prevAddresses_${i}_address`]}>
                <TextInput
                  type="text"
                  value={entry.address}
                  onChange={(e) => updateAddress(i, "address", e.target.value)}
                  placeholder="Street address, city, province"
                  error={errors[`prevAddresses_${i}_address`]}
                />
              </FormField>
              <Row>
                <FormField label="Postal Code" required error={errors[`prevAddresses_${i}_postalCode`]}>
                  <TextInput
                    type="text"
                    value={entry.postalCode}
                    onChange={(e) => updateAddress(i, "postalCode", e.target.value.toUpperCase())}
                    placeholder="A1B 2C3"
                    maxLength={7}
                    error={errors[`prevAddresses_${i}_postalCode`]}
                  />
                </FormField>
                <FormField label="Lived here since" required error={errors[`prevAddresses_${i}_since`]}>
                  <Row>
                    <SelectInput
                      value={entry.sinceMonth}
                      onChange={(e) => updateAddress(i, "sinceMonth", e.target.value)}
                      error={errors[`prevAddresses_${i}_since`]}
                    >
                      <option value="">Month</option>
                      {MONTHS.map((m, mi) => (
                        <option key={mi} value={String(mi + 1)}>{m}</option>
                      ))}
                    </SelectInput>
                    <TextInput
                      type="number"
                      value={entry.sinceYear}
                      onChange={(e) => updateAddress(i, "sinceYear", e.target.value)}
                      placeholder="Year"
                      min="1950"
                      max={String(new Date().getFullYear())}
                      error={errors[`prevAddresses_${i}_since`]}
                    />
                  </Row>
                </FormField>
              </Row>
            </div>
          ))}

          {needMoreAddresses && (
            <button
              type="button"
              onClick={addAddress}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "14px",
                fontWeight: 600,
                color: C.red,
                background: "none",
                border: `1px dashed ${C.line}`,
                borderRadius: "6px",
                padding: "10px 16px",
                cursor: "pointer",
                width: "100%",
                justifyContent: "center",
                marginBottom: "4px",
              }}
            >
              + Add{data.prevAddresses.length > 0 ? " another" : " a"} previous address
            </button>
          )}

          {errors.prevAddresses && (
            <p style={{ fontSize: "13px", color: C.red, marginTop: "6px" }}>{errors.prevAddresses}</p>
          )}
        </div>
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

      <FormField label="Marital Status" required error={errors.maritalStatus}>
        <SelectInput
          value={data.maritalStatus}
          onChange={(e) => set("maritalStatus", e.target.value)}
          error={errors.maritalStatus}
        >
          <option value="">Select…</option>
          {MARITAL_OPTIONS.filter(o => o.value !== "").map((o) => (
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
  setData,
  errors,
}: {
  data: FormData;
  set: (f: keyof FormData, v: string | boolean) => void;
  setData: React.Dispatch<React.SetStateAction<FormData>>;
  errors: Errors;
}) {
  const isEmployed = ["full-time", "part-time", "self-employed"].includes(
    data.employmentStatus
  );
  const needPrev = isEmployed && monthsSince(data.employerSinceYear, data.employerSinceMonth) < 24;

  const addEmployer = () =>
    setData((prev) => ({
      ...prev,
      prevEmployers: [...prev.prevEmployers, { employer: "", address: "", postalCode: "", sinceYear: "", sinceMonth: "" }],
    }));

  const removeEmployer = (i: number) =>
    setData((prev) => ({
      ...prev,
      prevEmployers: prev.prevEmployers.filter((_, idx) => idx !== i),
    }));

  const updateEmployer = (i: number, field: keyof PrevEmployer, value: string) =>
    setData((prev) => {
      const updated = [...prev.prevEmployers];
      updated[i] = { ...updated[i], [field]: value };
      return { ...prev, prevEmployers: updated };
    });

  const oldestPrevMonths =
    data.prevEmployers.length > 0
      ? monthsSince(
          data.prevEmployers[data.prevEmployers.length - 1].sinceYear,
          data.prevEmployers[data.prevEmployers.length - 1].sinceMonth
        )
      : 0;
  const needMoreEmployers = needPrev && oldestPrevMonths < 24;

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
            <FormField label="Employer Address">
              <TextInput
                type="text"
                value={data.employerAddress}
                onChange={(e) => set("employerAddress", e.target.value)}
                placeholder="123 Business Ave, City"
              />
            </FormField>
            <FormField label="Employer Phone">
              <TextInput
                type="tel"
                value={data.employerPhone}
                onChange={(e) => set("employerPhone", e.target.value)}
                placeholder="e.g. 4165550100"
              />
            </FormField>
          </Row>

          <Row>
            <FormField label="Gross Annual Income (CAD)">
              <TextInput
                type="number"
                value={data.annualIncome}
                onChange={(e) => set("annualIncome", stripCommas(e.target.value))}
                placeholder="e.g. 55000"
                min="0"
                step="1000"
              />
            </FormField>
            <FormField label="At Current Employer Since">
              <Row>
                <SelectInput
                  value={data.employerSinceMonth}
                  onChange={(e) => set("employerSinceMonth", e.target.value)}
                >
                  <option value="">Month</option>
                  {MONTHS.map((m, i) => (
                    <option key={i} value={String(i + 1)}>{m}</option>
                  ))}
                </SelectInput>
                <TextInput
                  type="number"
                  value={data.employerSinceYear}
                  onChange={(e) => set("employerSinceYear", e.target.value)}
                  placeholder="Year (e.g. 2019)"
                  min="1950"
                  max={String(new Date().getFullYear())}
                />
              </Row>
            </FormField>
          </Row>

          {needPrev && (
            <div style={{ marginTop: "8px" }}>
              <p style={{ fontSize: "13px", color: C.muted, marginBottom: "12px" }}>
                You've been at your current employer for less than 2 years. Please add previous employers going back at least 2 years total.
              </p>

              {data.prevEmployers.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    border: `1px solid ${C.line}`,
                    borderRadius: "8px",
                    padding: "16px",
                    marginBottom: "12px",
                    background: C.bg,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: C.ink }}>
                      Previous Employer {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEmployer(i)}
                      style={{ fontSize: "12px", color: C.red, background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
                    >
                      Remove
                    </button>
                  </div>
                  <Row>
                    <FormField label="Company Name" required error={errors[`prevEmployers_${i}_employer`]}>
                      <TextInput
                        type="text"
                        value={entry.employer}
                        onChange={(e) => updateEmployer(i, "employer", e.target.value)}
                        placeholder="Previous company name"
                        error={errors[`prevEmployers_${i}_employer`]}
                      />
                    </FormField>
                    <FormField label="Address" required error={errors[`prevEmployers_${i}_address`]}>
                      <TextInput
                        type="text"
                        value={entry.address}
                        onChange={(e) => updateEmployer(i, "address", e.target.value)}
                        placeholder="Company address"
                        error={errors[`prevEmployers_${i}_address`]}
                      />
                    </FormField>
                  </Row>
                  <Row>
                    <FormField label="Postal Code" required error={errors[`prevEmployers_${i}_postalCode`]}>
                      <TextInput
                        type="text"
                        value={entry.postalCode}
                        onChange={(e) => updateEmployer(i, "postalCode", e.target.value)}
                        placeholder="e.g. M5V 3A8"
                        error={errors[`prevEmployers_${i}_postalCode`]}
                      />
                    </FormField>
                    <FormField label="Employed here since" required error={errors[`prevEmployers_${i}_since`]}>
                      <Row>
                        <SelectInput
                          value={entry.sinceMonth}
                          onChange={(e) => updateEmployer(i, "sinceMonth", e.target.value)}
                          error={errors[`prevEmployers_${i}_since`]}
                        >
                          <option value="">Month</option>
                          {MONTHS.map((m, mi) => (
                            <option key={mi} value={String(mi + 1)}>{m}</option>
                          ))}
                        </SelectInput>
                        <TextInput
                          type="number"
                          value={entry.sinceYear}
                          onChange={(e) => updateEmployer(i, "sinceYear", e.target.value)}
                          placeholder="Year"
                          min="1950"
                          max={String(new Date().getFullYear())}
                          error={errors[`prevEmployers_${i}_since`]}
                        />
                      </Row>
                    </FormField>
                  </Row>
                </div>
              ))}

              {needMoreEmployers && (
                <button
                  type="button"
                  onClick={addEmployer}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: C.red,
                    background: "none",
                    border: `1px dashed ${C.line}`,
                    borderRadius: "6px",
                    padding: "10px 16px",
                    cursor: "pointer",
                    width: "100%",
                    justifyContent: "center",
                    marginBottom: "4px",
                  }}
                >
                  + Add{data.prevEmployers.length > 0 ? " another" : " a"} previous employer
                </button>
              )}

              {errors.prevEmployers && (
                <p style={{ fontSize: "13px", color: C.red, marginTop: "6px" }}>{errors.prevEmployers}</p>
              )}
            </div>
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
          + Choose file (JPG, PNG, HEIC, PDF · max 50 MB)
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
  errors,
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
        Enter the VIN from the vehicle you're interested in. Loan preferences are optional.
      </p>

      <FormField label="Vehicle VIN" required error={errors.vin}>
        <TextInput
          type="text"
          value={data.vin}
          onChange={(e) => set("vin", e.target.value.toUpperCase())}
          placeholder="17-character VIN (e.g. 1HGCM82633A123456)"
          maxLength={17}
          error={errors.vin}
        />
        <p style={{ fontSize: "12px", color: C.muted, marginTop: "4px" }}>
          You can find the VIN on the vehicle window sticker, dashboard, or in the listing.
        </p>
      </FormField>

      <Row>
        <FormField label="Down Payment (CAD)">
          <TextInput
            type="number"
            value={data.downPayment}
            onChange={(e) => set("downPayment", stripCommas(e.target.value))}
            placeholder="e.g. 3000"
            min="0"
            step="500"
          />
        </FormField>
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
    ["VIN", data.vin || (data.vehicleYear || data.vehicleMake ? [data.vehicleYear, data.vehicleMake, data.vehicleModel].filter(Boolean).join(" ") : "—")],
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

      <ConsentBox
        id="consent-license"
        checked={data.licenseConsent}
        onChange={(v) => set("licenseConsent", v)}
        error={errors.licenseConsent}
      >
        I authorize Alfursan Auto to collect and retain a copy of my driver's
        license for identity verification purposes.
      </ConsentBox>
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
      const res = await fetch("/api/finance/upload-url", {
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
        let errMsg = `Upload request failed (${res.status})`;
        try {
          const err = await res.json();
          errMsg = err.error ?? errMsg;
        } catch {
          errMsg = (await res.text().catch(() => "")) || errMsg;
        }
        throw new Error(errMsg);
      }

      let uploadData: { uploadUrl: string; storagePath: string };
      try {
        uploadData = await res.json();
      } catch {
        throw new Error("Server returned an invalid response");
      }
      const { uploadUrl, storagePath } = uploadData;

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
      const res = await fetch("/api/finance", {
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
                <Step1Personal data={formData} set={set} setData={setFormData} errors={errors} />
              )}
              {step === 2 && (
                <Step2Employment data={formData} set={set} setData={setFormData} errors={errors} />
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
                    disabled={submitting || !formData.consentAccurate || !formData.consentPrivacy || !formData.licenseConsent}
                    style={{
                      ...btnBase,
                      background: C.red,
                      color: C.white,
                      marginLeft: "auto",
                      opacity: (submitting || !formData.consentAccurate || !formData.consentPrivacy || !formData.licenseConsent) ? 0.5 : 1,
                      cursor: (submitting || !formData.consentAccurate || !formData.consentPrivacy || !formData.licenseConsent) ? "not-allowed" : "pointer",
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
