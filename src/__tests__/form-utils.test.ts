import { describe, it, expect } from "vitest";
import {
  stripCommas,
  monthsSince,
  validateStep,
  type FormData,
} from "../lib/form-utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

// Build a date that is `months` months in the past from today.
function pastDate(months: number): { year: string; month: string } {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return { year: String(d.getFullYear()), month: String(d.getMonth() + 1) };
}

// Build a date `months` in the future.
function futureDate(months: number): { year: string; month: string } {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return { year: String(d.getFullYear()), month: String(d.getMonth() + 1) };
}

// ── stripCommas ───────────────────────────────────────────────────────────────

describe("stripCommas", () => {
  it("removes a single comma", () => {
    expect(stripCommas("55,000")).toBe("55000");
  });

  it("removes multiple commas", () => {
    expect(stripCommas("1,000,000")).toBe("1000000");
  });

  it("passes through a string with no commas", () => {
    expect(stripCommas("55000")).toBe("55000");
  });

  it("passes through an empty string", () => {
    expect(stripCommas("")).toBe("");
  });
});

// ── monthsSince ───────────────────────────────────────────────────────────────

describe("monthsSince", () => {
  it("returns Infinity for empty year", () => {
    expect(monthsSince("", "3")).toBe(Infinity);
  });

  it("returns Infinity for empty month", () => {
    expect(monthsSince("2020", "")).toBe(Infinity);
  });

  it("returns Infinity for both empty", () => {
    expect(monthsSince("", "")).toBe(Infinity);
  });

  it("returns a positive number for a date in the past", () => {
    const { year, month } = pastDate(30);
    expect(monthsSince(year, month)).toBeGreaterThan(0);
  });

  it("returns a negative number for a future date", () => {
    const { year, month } = futureDate(3);
    expect(monthsSince(year, month)).toBeLessThan(0);
  });

  it("returns ~24 for a date 24 months ago (within ±1 month)", () => {
    const { year, month } = pastDate(24);
    const result = monthsSince(year, month);
    expect(result).toBeGreaterThanOrEqual(23);
    expect(result).toBeLessThanOrEqual(25);
  });

  it("returns a large number for a very old date", () => {
    expect(monthsSince("2000", "1")).toBeGreaterThan(200);
  });
});

// ── validateStep helpers ──────────────────────────────────────────────────────

// Minimal valid FormData with a 3-year-old address (no prev addresses needed).
const OLD = pastDate(36); // 3 years ago — always > 24 months
const OLD_EMPLOYER = pastDate(30); // 2.5 years ago — always > 24 months

const BASE: FormData = {
  fullName: "Jane Smith",
  dob: "1990-06-15",
  address: "100 King St W",
  postalCode: "M5X 1A9",
  addressSinceYear: OLD.year,
  addressSinceMonth: OLD.month,
  prevAddresses: [],
  phone: "4165559999",
  email: "jane@example.com",
  maritalStatus: "single",
  employmentStatus: "full-time",
  employer: "Acme Corp",
  employerAddress: "200 Bay St",
  employerPhone: "4165550001",
  jobTitle: "Engineer",
  annualIncome: "75000",
  employerSinceYear: OLD_EMPLOYER.year,
  employerSinceMonth: OLD_EMPLOYER.month,
  prevEmployers: [],
  vehicleYear: "2022",
  vehicleMake: "Honda",
  vehicleModel: "Civic",
  vehiclePrice: "25000",
  downPayment: "5000",
  loanTermMonths: "60",
  vin: "1HGCM82633A004352",
  listingSlug: "",
  draftId: "draft-abc",
  licenseFrontPath: "tmp/draft-abc/front.jpg",
  licenseBackPath: "tmp/draft-abc/back.jpg",
  consentAccurate: true,
  consentPrivacy: true,
  licenseConsent: true,
};

function base(overrides: Partial<FormData> = {}): FormData {
  return { ...BASE, ...overrides };
}

// ── Step 1: personal info ─────────────────────────────────────────────────────

describe("validateStep(1) — personal info", () => {
  it("returns no errors for a valid step 1", () => {
    expect(validateStep(1, base())).toEqual({});
  });

  it("requires fullName", () => {
    const e = validateStep(1, base({ fullName: "" }));
    expect(e.fullName).toBeTruthy();
  });

  it("requires dob", () => {
    const e = validateStep(1, base({ dob: "" }));
    expect(e.dob).toBeTruthy();
  });

  it("requires address", () => {
    const e = validateStep(1, base({ address: "" }));
    expect(e.address).toBeTruthy();
  });

  it("requires postalCode", () => {
    const e = validateStep(1, base({ postalCode: "" }));
    expect(e.postalCode).toBeTruthy();
  });

  it("rejects invalid Canadian postal code", () => {
    const e = validateStep(1, base({ postalCode: "12345" }));
    expect(e.postalCode).toBeTruthy();
  });

  it("accepts postal code with space — M5V 3A8", () => {
    const e = validateStep(1, base({ postalCode: "M5V 3A8" }));
    expect(e.postalCode).toBeUndefined();
  });

  it("accepts postal code without space — M5V3A8", () => {
    const e = validateStep(1, base({ postalCode: "M5V3A8" }));
    expect(e.postalCode).toBeUndefined();
  });

  it("requires email", () => {
    const e = validateStep(1, base({ email: "" }));
    expect(e.email).toBeTruthy();
  });

  it("rejects malformed email", () => {
    const e = validateStep(1, base({ email: "not-an-email" }));
    expect(e.email).toBeTruthy();
  });

  it("requires phone", () => {
    const e = validateStep(1, base({ phone: "" }));
    expect(e.phone).toBeTruthy();
  });

  it("requires maritalStatus", () => {
    const e = validateStep(1, base({ maritalStatus: "" }));
    expect(e.maritalStatus).toBeTruthy();
  });

  it("requires addressSince fields", () => {
    const e = validateStep(1, base({ addressSinceYear: "", addressSinceMonth: "" }));
    expect(e.addressSinceYear).toBeTruthy();
  });

  it("rejects a future addressSince date", () => {
    const { year, month } = futureDate(3);
    const e = validateStep(1, base({ addressSinceYear: year, addressSinceMonth: month }));
    expect(e.addressSinceYear).toMatch(/future/i);
  });
});

// ── Step 1: address history when < 24 months at current address ───────────────

describe("validateStep(1) — address history", () => {
  const recent = pastDate(12); // only 12 months — needs history

  it("requires at least one prev address when current address < 24 months", () => {
    const e = validateStep(
      1,
      base({
        addressSinceYear: recent.year,
        addressSinceMonth: recent.month,
        prevAddresses: [],
      })
    );
    expect(e.prevAddresses).toBeTruthy();
  });

  it("requires prev address to cover 2 years total", () => {
    const insufficient = pastDate(18); // still only 18 months total from a 12-month stay
    const e = validateStep(
      1,
      base({
        addressSinceYear: recent.year,
        addressSinceMonth: recent.month,
        prevAddresses: [
          {
            address: "50 Old St",
            postalCode: "M1B 1B1",
            sinceYear: insufficient.year,
            sinceMonth: insufficient.month,
          },
        ],
      })
    );
    expect(e.prevAddresses).toMatch(/2 year/i);
  });

  it("accepts sufficient address history", () => {
    const old = pastDate(36);
    const e = validateStep(
      1,
      base({
        addressSinceYear: recent.year,
        addressSinceMonth: recent.month,
        prevAddresses: [
          {
            address: "50 Old St",
            postalCode: "M1B 1B1",
            sinceYear: old.year,
            sinceMonth: old.month,
          },
        ],
      })
    );
    expect(e.prevAddresses).toBeUndefined();
  });

  it("validates fields inside each prev address entry", () => {
    const old = pastDate(36);
    const e = validateStep(
      1,
      base({
        addressSinceYear: recent.year,
        addressSinceMonth: recent.month,
        prevAddresses: [
          {
            address: "",           // missing
            postalCode: "bad",     // invalid
            sinceYear: old.year,
            sinceMonth: old.month,
          },
        ],
      })
    );
    expect(e["prevAddresses_0_address"]).toBeTruthy();
    expect(e["prevAddresses_0_postalCode"]).toBeTruthy();
  });
});

// ── Step 2: employment ────────────────────────────────────────────────────────

describe("validateStep(2) — employment", () => {
  it("returns no errors for valid step 2", () => {
    expect(validateStep(2, base())).toEqual({});
  });

  it("requires employmentStatus", () => {
    const e = validateStep(2, base({ employmentStatus: "" }));
    expect(e.employmentStatus).toBeTruthy();
  });

  it("does not require employment history when status is not employed", () => {
    const e = validateStep(
      2,
      base({ employmentStatus: "retired", prevEmployers: [] })
    );
    expect(e.prevEmployers).toBeUndefined();
  });
});

// ── Step 2: employer history when < 24 months ─────────────────────────────────

describe("validateStep(2) — employer history", () => {
  const recentJob = pastDate(10); // 10 months at current employer

  it("requires prev employer when current job < 24 months", () => {
    const e = validateStep(
      2,
      base({
        employerSinceYear: recentJob.year,
        employerSinceMonth: recentJob.month,
        prevEmployers: [],
      })
    );
    expect(e.prevEmployers).toBeTruthy();
  });

  it("requires prev employer history to cover 2 years total", () => {
    const insufficient = pastDate(18);
    const e = validateStep(
      2,
      base({
        employerSinceYear: recentJob.year,
        employerSinceMonth: recentJob.month,
        prevEmployers: [
          { employer: "Old Corp", sinceYear: insufficient.year, sinceMonth: insufficient.month },
        ],
      })
    );
    expect(e.prevEmployers).toMatch(/2 year/i);
  });

  it("accepts sufficient employer history", () => {
    const old = pastDate(36);
    const e = validateStep(
      2,
      base({
        employerSinceYear: recentJob.year,
        employerSinceMonth: recentJob.month,
        prevEmployers: [
          { employer: "Old Corp", sinceYear: old.year, sinceMonth: old.month },
        ],
      })
    );
    expect(e.prevEmployers).toBeUndefined();
  });

  it("validates fields inside prev employer entry", () => {
    const old = pastDate(36);
    const e = validateStep(
      2,
      base({
        employerSinceYear: recentJob.year,
        employerSinceMonth: recentJob.month,
        prevEmployers: [
          { employer: "", sinceYear: old.year, sinceMonth: old.month },
        ],
      })
    );
    expect(e["prevEmployers_0_employer"]).toBeTruthy();
  });
});

// ── Step 3: VIN ───────────────────────────────────────────────────────────────

describe("validateStep(3) — VIN", () => {
  it("returns no errors for a valid 17-char VIN", () => {
    expect(validateStep(3, base())).toEqual({});
  });

  it("requires VIN", () => {
    const e = validateStep(3, base({ vin: "" }));
    expect(e.vin).toBeTruthy();
  });

  it("rejects VIN with 16 characters", () => {
    const e = validateStep(3, base({ vin: "1HGCM82633A00435" }));
    expect(e.vin).toMatch(/17/);
  });

  it("rejects VIN with 18 characters", () => {
    const e = validateStep(3, base({ vin: "1HGCM82633A004352X" }));
    expect(e.vin).toMatch(/17/);
  });

  it("accepts a VIN with exactly 17 characters", () => {
    const e = validateStep(3, base({ vin: "JH4KA7650MC012345" }));
    expect(e.vin).toBeUndefined();
  });
});

// ── Step 4: consent ───────────────────────────────────────────────────────────

describe("validateStep(4) — consent", () => {
  it("returns no errors when all consents are true", () => {
    expect(validateStep(4, base())).toEqual({});
  });

  it("requires consentAccurate", () => {
    const e = validateStep(4, base({ consentAccurate: false }));
    expect(e.consentAccurate).toBeTruthy();
  });

  it("requires consentPrivacy", () => {
    const e = validateStep(4, base({ consentPrivacy: false }));
    expect(e.consentPrivacy).toBeTruthy();
  });

  it("requires licenseConsent", () => {
    const e = validateStep(4, base({ licenseConsent: false }));
    expect(e.licenseConsent).toBeTruthy();
  });

  it("requires all three when all are false", () => {
    const e = validateStep(
      4,
      base({ consentAccurate: false, consentPrivacy: false, licenseConsent: false })
    );
    expect(Object.keys(e)).toHaveLength(3);
  });
});
