import { describe, it, expect } from "vitest";
import { validateUserInviteForm, validateUserEditForm } from "../components/admin/UsersPage";

describe("validateUserInviteForm", () => {
  function baseForm(overrides: Partial<{ email: string; role: string; commission: string }> = {}) {
    return { email: "sales@example.com", role: "sales", commission: "10", ...overrides };
  }

  it("accepts a fully valid form", () => {
    expect(validateUserInviteForm(baseForm())).toEqual({});
  });

  it("accepts an omitted commission (optional)", () => {
    expect(validateUserInviteForm(baseForm({ commission: "" })).commission_percentage).toBeFalsy();
  });

  it("rejects a malformed email", () => {
    expect(validateUserInviteForm(baseForm({ email: "not-an-email" })).email).toBeTruthy();
  });

  it("rejects an invalid role", () => {
    expect(validateUserInviteForm(baseForm({ role: "admin" })).role).toBeTruthy();
  });

  it("rejects a commission out of 0-100 range", () => {
    expect(validateUserInviteForm(baseForm({ commission: "150" })).commission_percentage).toBeTruthy();
    expect(validateUserInviteForm(baseForm({ commission: "-5" })).commission_percentage).toBeTruthy();
  });
});

describe("validateUserEditForm", () => {
  function baseForm(overrides: Partial<{ role: string; commission: string }> = {}) {
    return { role: "manager", commission: "15", ...overrides };
  }

  it("accepts a fully valid form", () => {
    expect(validateUserEditForm(baseForm())).toEqual({});
  });

  it("accepts a cleared commission (nullable)", () => {
    expect(validateUserEditForm(baseForm({ commission: "" })).commission_percentage).toBeFalsy();
  });

  it("rejects an invalid role", () => {
    expect(validateUserEditForm(baseForm({ role: "admin" })).role).toBeTruthy();
  });

  it("rejects a commission out of 0-100 range", () => {
    expect(validateUserEditForm(baseForm({ commission: "101" })).commission_percentage).toBeTruthy();
  });
});
