import { describe, it, expect } from "vitest";
import {
  expenseCreateSchema,
  businessExpenseCreateSchema,
  expenseUpdateSchema,
  documentCreateSchema,
  commissionAssignSchema,
  vehicleCreateSchema,
  EXPENSE_CATEGORIES,
  BUSINESS_EXPENSE_CATEGORIES,
  TAX_TYPES,
  DEFAULT_TAX_TYPE,
  DEFAULT_TAX_RATE,
  rateForTaxType,
} from "../lib/vehicles";

// ── TAX_TYPES ─────────────────────────────────────────────────────────────────

describe("TAX_TYPES / rateForTaxType", () => {
  it("defaults to Ontario HST at 13%", () => {
    expect(DEFAULT_TAX_TYPE).toBe("HST_ON");
    expect(DEFAULT_TAX_RATE).toBe(0.13);
  });

  it("every tax type has a rate between 0 and 1", () => {
    for (const t of TAX_TYPES) {
      expect(t.rate).toBeGreaterThanOrEqual(0);
      expect(t.rate).toBeLessThan(1);
    }
  });

  it("looks up the rate for a known type", () => {
    expect(rateForTaxType("GST_ONLY")).toBe(0.05);
  });

  it("returns undefined for an unknown type", () => {
    expect(rateForTaxType("VAT")).toBeUndefined();
  });
});

// ── expenseCreateSchema ───────────────────────────────────────────────────────

describe("expenseCreateSchema", () => {
  const BASE = { category: "repair", description: "Fix brakes", amount: 500 };

  it("accepts a valid expense", () => {
    expect(expenseCreateSchema.safeParse(BASE).success).toBe(true);
  });

  // ── businessExpenseCreateSchema ──────────────────────────────────────────────

  describe("businessExpenseCreateSchema", () => {
    const BASE = { category: "gas", description: "Fuel run", amount: 120, expense_date: "2026-07-25" };

    it("accepts a valid business expense", () => {
      expect(businessExpenseCreateSchema.safeParse(BASE).success).toBe(true);
    });

    it("requires expense_date", () => {
      expect(businessExpenseCreateSchema.safeParse({ category: "gas", description: "Fuel run", amount: 120 }).success).toBe(false);
    });

    it("accepts all valid business categories", () => {
      for (const cat of BUSINESS_EXPENSE_CATEGORIES) {
        expect(businessExpenseCreateSchema.safeParse({ ...BASE, category: cat }).success).toBe(true);
      }
    });

    it("accepts optional receipt_file_path", () => {
      expect(
        businessExpenseCreateSchema.safeParse({ ...BASE, receipt_file_path: "business-expenses/receipt.pdf" }).success
      ).toBe(true);
    });

    it("rejects a tax_rate that does not match the selected tax_type", () => {
      const result = businessExpenseCreateSchema.safeParse({ ...BASE, tax_type: "HST_ON", tax_rate: 0.05 });
      expect(result.success).toBe(false);
    });
  });

  it("accepts all valid categories", () => {
    for (const cat of EXPENSE_CATEGORIES) {
      expect(expenseCreateSchema.safeParse({ ...BASE, category: cat }).success).toBe(true);
    }
  });

  it("rejects an invalid category", () => {
    expect(expenseCreateSchema.safeParse({ ...BASE, category: "fuel" }).success).toBe(false);
  });

  it("rejects amount = 0", () => {
    expect(expenseCreateSchema.safeParse({ ...BASE, amount: 0 }).success).toBe(false);
  });

  it("accepts a negative amount (refund/credit/adjustment)", () => {
    expect(expenseCreateSchema.safeParse({ ...BASE, amount: -1 }).success).toBe(true);
  });

  it("accepts optional vendor", () => {
    expect(expenseCreateSchema.safeParse({ ...BASE, vendor: "Divine Motors" }).success).toBe(true);
  });

  it("accepts optional expense_date", () => {
    expect(expenseCreateSchema.safeParse({ ...BASE, expense_date: "2025-09-13" }).success).toBe(true);
  });

  it("rejects a malformed expense_date", () => {
    expect(expenseCreateSchema.safeParse({ ...BASE, expense_date: "9/13/2025" }).success).toBe(false);
  });

  it("accepts optional tax_amount and tax_type", () => {
    expect(expenseCreateSchema.safeParse({ ...BASE, tax_amount: 65, tax_type: "HST_ON", tax_rate: 0.13 }).success).toBe(true);
  });

  it("rejects an unrecognized tax_type", () => {
    expect(expenseCreateSchema.safeParse({ ...BASE, tax_type: "VAT" }).success).toBe(false);
  });

  it("rejects a negative tax_amount", () => {
    expect(expenseCreateSchema.safeParse({ ...BASE, tax_amount: -5 }).success).toBe(false);
  });

  it("rejects a tax_rate that doesn't match the selected tax_type (drift protection)", () => {
    const result = expenseCreateSchema.safeParse({ ...BASE, tax_type: "HST_ON", tax_rate: 0.05 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.tax_rate?.[0]).toMatch(/does not match/);
    }
  });

  it("accepts tax_type with no tax_rate given", () => {
    expect(expenseCreateSchema.safeParse({ ...BASE, tax_type: "GST_ONLY" }).success).toBe(true);
  });

  it("accepts tax_rate with no tax_type given", () => {
    expect(expenseCreateSchema.safeParse({ ...BASE, tax_rate: 0.05 }).success).toBe(true);
  });

  it("accepts every tax_type paired with its own canonical rate", () => {
    for (const t of TAX_TYPES) {
      expect(expenseCreateSchema.safeParse({ ...BASE, tax_type: t.code, tax_rate: t.rate }).success).toBe(true);
    }
  });

  it("rejects empty description", () => {
    expect(expenseCreateSchema.safeParse({ ...BASE, description: "" }).success).toBe(false);
  });

  it("accepts optional receipt_file_path", () => {
    expect(
      expenseCreateSchema.safeParse({ ...BASE, receipt_file_path: "vehicles/VIN/receipt.jpg" }).success
    ).toBe(true);
  });

  it("accepts without receipt_file_path", () => {
    expect(expenseCreateSchema.safeParse(BASE).success).toBe(true);
  });

  it("accepts optional reimbursed flag", () => {
    expect(expenseCreateSchema.safeParse({ ...BASE, reimbursed: true }).success).toBe(true);
  });

  it("accepts without reimbursed (defaults handled by DB)", () => {
    expect(expenseCreateSchema.safeParse(BASE).success).toBe(true);
  });

  it("includes 'cleaning' and 'admin', not 'detailing'", () => {
    expect(EXPENSE_CATEGORIES).toContain("cleaning");
    expect(EXPENSE_CATEGORIES).toContain("admin");
    expect(EXPENSE_CATEGORIES).not.toContain("detailing");
  });
});

// ── expenseUpdateSchema ───────────────────────────────────────────────────────

describe("expenseUpdateSchema", () => {
  it("accepts reimbursed: true", () => {
    expect(expenseUpdateSchema.safeParse({ reimbursed: true }).success).toBe(true);
  });

  it("accepts reimbursed: false", () => {
    expect(expenseUpdateSchema.safeParse({ reimbursed: false }).success).toBe(true);
  });

  it("rejects missing reimbursed", () => {
    expect(expenseUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("rejects non-boolean reimbursed", () => {
    expect(expenseUpdateSchema.safeParse({ reimbursed: "yes" }).success).toBe(false);
  });
});

// ── vehicleCreateSchema — lead_source ─────────────────────────────────────────

describe("vehicleCreateSchema lead_source", () => {
  const BASE_VEHICLE = { vin: "1HGCM82633A123456", make: "Honda", model: "Accord", year: 2020, body_type: "sedan" };

  it("accepts a vehicle with lead_source", () => {
    expect(vehicleCreateSchema.safeParse({ ...BASE_VEHICLE, lead_source: "CarGurus" }).success).toBe(true);
  });

  it("accepts a vehicle without lead_source", () => {
    expect(vehicleCreateSchema.safeParse(BASE_VEHICLE).success).toBe(true);
  });
});

// ── documentCreateSchema ──────────────────────────────────────────────────────

describe("documentCreateSchema", () => {
  const BASE = { document_type: "safety_inspection", file_path: "vehicles/VIN/docs/safety.pdf" };

  it("accepts a valid document", () => {
    expect(documentCreateSchema.safeParse(BASE).success).toBe(true);
  });

  it("rejects empty document_type", () => {
    expect(documentCreateSchema.safeParse({ ...BASE, document_type: "" }).success).toBe(false);
  });

  it("rejects empty file_path", () => {
    expect(documentCreateSchema.safeParse({ ...BASE, file_path: "" }).success).toBe(false);
  });

  it("accepts optional description", () => {
    expect(documentCreateSchema.safeParse({ ...BASE, description: "Signed copy" }).success).toBe(true);
  });

  it("accepts without description", () => {
    expect(documentCreateSchema.safeParse(BASE).success).toBe(true);
  });
});

// ── commissionAssignSchema ────────────────────────────────────────────────────

describe("commissionAssignSchema", () => {
  it("accepts a valid UUID", () => {
    expect(
      commissionAssignSchema.safeParse({ commission_user_id: "123e4567-e89b-12d3-a456-426614174000" }).success
    ).toBe(true);
  });

  it("accepts null (clears assignment)", () => {
    expect(commissionAssignSchema.safeParse({ commission_user_id: null }).success).toBe(true);
  });

  it("rejects an invalid UUID string", () => {
    expect(commissionAssignSchema.safeParse({ commission_user_id: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects missing field", () => {
    expect(commissionAssignSchema.safeParse({}).success).toBe(false);
  });
});
