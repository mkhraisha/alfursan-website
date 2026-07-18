import { describe, it, expect } from "vitest";
import {
  expenseCreateSchema,
  documentCreateSchema,
  commissionAssignSchema,
  EXPENSE_CATEGORIES,
} from "../lib/vehicles";

// ── expenseCreateSchema ───────────────────────────────────────────────────────

describe("expenseCreateSchema", () => {
  const BASE = { category: "repair", description: "Fix brakes", amount: 500 };

  it("accepts a valid expense", () => {
    expect(expenseCreateSchema.safeParse(BASE).success).toBe(true);
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

  it("rejects amount < 0", () => {
    expect(expenseCreateSchema.safeParse({ ...BASE, amount: -1 }).success).toBe(false);
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
