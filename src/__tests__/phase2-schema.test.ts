import { describe, it, expect } from "vitest";
import { phase2Schema, referenceSchema } from "../lib/phase2-schema";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const APP_UUID   = "660e8400-e29b-41d4-a716-446655440001";

const VALID_REFS = [
  { name: "Alice Brown",  phone: "4165550001", relationship: "Friend"    },
  { name: "Bob Johnson",  phone: "4165550002", relationship: "Colleague" },
];

const VALID_PHASE2 = {
  phase2Token:        VALID_UUID,
  appId:              APP_UUID,
  voidChequePath:     "phase2/abc/void_cheque.pdf",
  proofInsurancePath: "phase2/abc/proof_insurance.pdf",
  payslipPath:        "phase2/abc/payslip.pdf",
  dealertrackConsent: true,
  references:         VALID_REFS,
};

// ── referenceSchema ───────────────────────────────────────────────────────────

describe("referenceSchema", () => {
  it("accepts a valid reference", () => {
    expect(referenceSchema.safeParse(VALID_REFS[0]).success).toBe(true);
  });

  it("rejects missing name", () => {
    const r = referenceSchema.safeParse({ ...VALID_REFS[0], name: "" });
    expect(r.success).toBe(false);
  });

  it("rejects name shorter than 2 chars", () => {
    const r = referenceSchema.safeParse({ ...VALID_REFS[0], name: "A" });
    expect(r.success).toBe(false);
  });

  it("rejects missing phone", () => {
    const r = referenceSchema.safeParse({ ...VALID_REFS[0], phone: "" });
    expect(r.success).toBe(false);
  });

  it("rejects phone shorter than 7 chars", () => {
    const r = referenceSchema.safeParse({ ...VALID_REFS[0], phone: "123" });
    expect(r.success).toBe(false);
  });

  it("rejects missing relationship", () => {
    const r = referenceSchema.safeParse({ ...VALID_REFS[0], relationship: "" });
    expect(r.success).toBe(false);
  });
});

// ── phase2Schema ──────────────────────────────────────────────────────────────

describe("phase2Schema", () => {
  it("accepts a fully valid payload", () => {
    expect(phase2Schema.safeParse(VALID_PHASE2).success).toBe(true);
  });

  it("rejects non-UUID phase2Token", () => {
    const r = phase2Schema.safeParse({ ...VALID_PHASE2, phase2Token: "not-a-uuid" });
    expect(r.success).toBe(false);
  });

  it("rejects non-UUID appId", () => {
    const r = phase2Schema.safeParse({ ...VALID_PHASE2, appId: "bad-id" });
    expect(r.success).toBe(false);
  });

  it("rejects empty voidChequePath", () => {
    const r = phase2Schema.safeParse({ ...VALID_PHASE2, voidChequePath: "" });
    expect(r.success).toBe(false);
  });

  it("rejects empty proofInsurancePath", () => {
    const r = phase2Schema.safeParse({ ...VALID_PHASE2, proofInsurancePath: "" });
    expect(r.success).toBe(false);
  });

  it("rejects empty payslipPath", () => {
    const r = phase2Schema.safeParse({ ...VALID_PHASE2, payslipPath: "" });
    expect(r.success).toBe(false);
  });

  it("rejects dealertrackConsent = false", () => {
    const r = phase2Schema.safeParse({ ...VALID_PHASE2, dealertrackConsent: false });
    expect(r.success).toBe(false);
  });

  it("rejects fewer than 2 references", () => {
    const r = phase2Schema.safeParse({ ...VALID_PHASE2, references: [VALID_REFS[0]] });
    expect(r.success).toBe(false);
  });

  it("rejects more than 2 references", () => {
    const r = phase2Schema.safeParse({ ...VALID_PHASE2, references: [...VALID_REFS, VALID_REFS[0]] });
    expect(r.success).toBe(false);
  });

  it("rejects when a reference has an invalid field", () => {
    const r = phase2Schema.safeParse({
      ...VALID_PHASE2,
      references: [{ ...VALID_REFS[0], name: "" }, VALID_REFS[1]],
    });
    expect(r.success).toBe(false);
  });

  it("returns typed data on success", () => {
    const r = phase2Schema.safeParse(VALID_PHASE2);
    if (!r.success) throw new Error("expected success");
    expect(r.data.references).toHaveLength(2);
    expect(r.data.phase2Token).toBe(VALID_UUID);
  });
});
