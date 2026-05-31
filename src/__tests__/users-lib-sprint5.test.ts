import { describe, it, expect } from "vitest";
import { userCreateSchema, userUpdateSchema } from "../lib/users";

// ── userCreateSchema ──────────────────────────────────────────────────────────

describe("userCreateSchema", () => {
  const BASE = { email: "user@example.com", role: "sales" as const };

  it("accepts valid manager user", () => {
    expect(userCreateSchema.safeParse({ email: "manager@test.com", role: "manager" }).success).toBe(true);
  });

  it("accepts valid sales user with commission", () => {
    expect(userCreateSchema.safeParse({ ...BASE, commission_percentage: 5.5 }).success).toBe(true);
  });

  it("accepts without commission_percentage", () => {
    expect(userCreateSchema.safeParse(BASE).success).toBe(true);
  });

  it("rejects invalid email", () => {
    expect(userCreateSchema.safeParse({ ...BASE, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects invalid role", () => {
    expect(userCreateSchema.safeParse({ ...BASE, role: "superadmin" }).success).toBe(false);
  });

  it("rejects commission_percentage > 100", () => {
    expect(userCreateSchema.safeParse({ ...BASE, commission_percentage: 101 }).success).toBe(false);
  });

  it("rejects commission_percentage < 0", () => {
    expect(userCreateSchema.safeParse({ ...BASE, commission_percentage: -1 }).success).toBe(false);
  });

  it("accepts commission_percentage = 0", () => {
    expect(userCreateSchema.safeParse({ ...BASE, commission_percentage: 0 }).success).toBe(true);
  });
});

// ── userUpdateSchema ──────────────────────────────────────────────────────────

describe("userUpdateSchema", () => {
  it("accepts role update only", () => {
    expect(userUpdateSchema.safeParse({ role: "manager" }).success).toBe(true);
  });

  it("accepts commission_percentage update only", () => {
    expect(userUpdateSchema.safeParse({ commission_percentage: 10 }).success).toBe(true);
  });

  it("accepts is_active = false (disable)", () => {
    expect(userUpdateSchema.safeParse({ is_active: false }).success).toBe(true);
  });

  it("accepts is_active = true (re-enable)", () => {
    expect(userUpdateSchema.safeParse({ is_active: true }).success).toBe(true);
  });

  it("accepts null commission_percentage (clear)", () => {
    expect(userUpdateSchema.safeParse({ commission_percentage: null }).success).toBe(true);
  });

  it("accepts all fields together", () => {
    expect(
      userUpdateSchema.safeParse({ role: "sales", commission_percentage: 8, is_active: true }).success
    ).toBe(true);
  });

  it("rejects empty object (no fields)", () => {
    expect(userUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("rejects invalid role", () => {
    expect(userUpdateSchema.safeParse({ role: "staff" }).success).toBe(false);
  });

  it("rejects commission_percentage > 100", () => {
    expect(userUpdateSchema.safeParse({ commission_percentage: 200 }).success).toBe(false);
  });
});
