import { describe, it, expect } from "vitest";

// ── Helpers mirroring the logic in src/pages/api/financing.ts ────────────────

function parseNumeric(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseIntField(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "");
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

// ── parseNumeric ─────────────────────────────────────────────────────────────

describe("parseNumeric (annualIncome / downPayment / vehiclePrice)", () => {
  it("parses plain integer string", () => {
    expect(parseNumeric("55000")).toBe(55000);
  });

  it("strips comma thousands separator — 55,000 → 55000", () => {
    expect(parseNumeric("55,000")).toBe(55000);
  });

  it("strips multiple commas — 1,000,000 → 1000000", () => {
    expect(parseNumeric("1,000,000")).toBe(1000000);
  });

  it("handles decimal values", () => {
    expect(parseNumeric("1234.56")).toBeCloseTo(1234.56);
  });

  it("returns null for empty string", () => {
    expect(parseNumeric("")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseNumeric(undefined)).toBeNull();
  });

  it("returns null for non-numeric garbage", () => {
    expect(parseNumeric("abc")).toBeNull();
  });
});

// ── parseIntField ────────────────────────────────────────────────────────────

describe("parseIntField (loanTermMonths)", () => {
  it("parses plain integer string", () => {
    expect(parseIntField("60")).toBe(60);
  });

  it("strips comma — 1,200 → 1200", () => {
    expect(parseIntField("1,200")).toBe(1200);
  });

  it("truncates decimal — 60.9 → 60", () => {
    expect(parseIntField("60.9")).toBe(60);
  });

  it("returns null for empty string", () => {
    expect(parseIntField("")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseIntField(undefined)).toBeNull();
  });
});
