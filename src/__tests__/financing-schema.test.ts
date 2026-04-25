import { describe, it, expect } from "vitest";
import { financingSchema } from "../lib/financing-schema";

// Minimal valid payload — the baseline every test mutates
const BASE: Record<string, unknown> = {
  fullName: "John Doe",
  dob: "1990-05-15",
  address: "123 Main St",
  postalCode: "M1A 1A1",
  addressSinceYear: "2020",
  addressSinceMonth: "3",
  phone: "4165551234",
  email: "john@example.com",
  maritalStatus: "single",
  employmentStatus: "employed",
  vin: "1HGCM82633A004352",
  consentAccurate: true,
  consentPrivacy: true,
  licenseConsent: true,
};

function valid(overrides: Record<string, unknown> = {}) {
  return { ...BASE, ...overrides };
}

// ── Happy path ───────────────────────────────────────────────────────────────

describe("financingSchema — valid payload", () => {
  it("accepts a minimal valid submission", () => {
    const result = financingSchema.safeParse(valid());
    expect(result.success).toBe(true);
  });

  it("accepts optional numeric fields as strings", () => {
    const result = financingSchema.safeParse(
      valid({ annualIncome: "55000", downPayment: "3000", loanTermMonths: "60" })
    );
    expect(result.success).toBe(true);
  });

  it("accepts comma-formatted numbers (schema is string-typed; API strips commas)", () => {
    // The Zod schema stores these as strings — stripping is done in the API.
    // This test confirms the schema does NOT reject "55,000".
    const result = financingSchema.safeParse(valid({ annualIncome: "55,000" }));
    expect(result.success).toBe(true);
  });

  it("accepts prevAddresses array", () => {
    const result = financingSchema.safeParse(
      valid({
        prevAddresses: [
          { address: "456 Old Rd", postalCode: "M2B 2B2", sinceYear: "2018", sinceMonth: "1" },
        ],
      })
    );
    expect(result.success).toBe(true);
  });

  it("accepts prevEmployers array", () => {
    const result = financingSchema.safeParse(
      valid({
        prevEmployers: [
          { employer: "Acme Corp", sinceYear: "2017", sinceMonth: "6" },
        ],
      })
    );
    expect(result.success).toBe(true);
  });

  it("accepts employerAddress and employerPhone optional fields", () => {
    const result = financingSchema.safeParse(
      valid({ employerAddress: "200 Bay St, Toronto ON", employerPhone: "4165550001" })
    );
    expect(result.success).toBe(true);
  });

  it("accepts submission without employerAddress or employerPhone", () => {
    const result = financingSchema.safeParse(valid());
    expect(result.success).toBe(true);
  });
});

// ── Required fields ──────────────────────────────────────────────────────────

describe("financingSchema — required fields", () => {
  it("rejects missing fullName", () => {
    const result = financingSchema.safeParse(valid({ fullName: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects missing dob", () => {
    const result = financingSchema.safeParse(valid({ dob: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const result = financingSchema.safeParse(valid({ email: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = financingSchema.safeParse(valid({ email: "not-an-email" }));
    expect(result.success).toBe(false);
  });

  it("rejects short phone", () => {
    const result = financingSchema.safeParse(valid({ phone: "123" }));
    expect(result.success).toBe(false);
  });
});

// ── VIN validation ───────────────────────────────────────────────────────────

describe("financingSchema — VIN", () => {
  it("accepts exactly 17-character VIN", () => {
    const result = financingSchema.safeParse(valid({ vin: "1HGCM82633A004352" }));
    expect(result.success).toBe(true);
  });

  it("rejects VIN shorter than 17 characters", () => {
    const result = financingSchema.safeParse(valid({ vin: "1HGCM82633A00435" })); // 16 chars
    expect(result.success).toBe(false);
  });

  it("rejects VIN longer than 17 characters", () => {
    const result = financingSchema.safeParse(valid({ vin: "1HGCM82633A0043521" })); // 18 chars
    expect(result.success).toBe(false);
  });

  it("rejects empty VIN", () => {
    const result = financingSchema.safeParse(valid({ vin: "" }));
    expect(result.success).toBe(false);
  });
});

// ── Consent checkboxes ───────────────────────────────────────────────────────

describe("financingSchema — consent", () => {
  it("rejects consentAccurate = false", () => {
    const result = financingSchema.safeParse(valid({ consentAccurate: false }));
    expect(result.success).toBe(false);
  });

  it("rejects consentPrivacy = false", () => {
    const result = financingSchema.safeParse(valid({ consentPrivacy: false }));
    expect(result.success).toBe(false);
  });

  it("rejects licenseConsent = false", () => {
    const result = financingSchema.safeParse(valid({ licenseConsent: false }));
    expect(result.success).toBe(false);
  });
});
