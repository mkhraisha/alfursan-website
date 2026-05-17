import { describe, it, expect } from "vitest";
import { can } from "../lib/permissions";

// ── Owner (implicit all-access) ───────────────────────────────────────────────

describe("can() — owner role", () => {
  it("allows financing:read", () => {
    expect(can("owner", "financing:read")).toBe(true);
  });

  it("allows financing:write", () => {
    expect(can("owner", "financing:write")).toBe(true);
  });

  it("allows financing:delete", () => {
    expect(can("owner", "financing:delete")).toBe(true);
  });

  it("allows financing:export", () => {
    expect(can("owner", "financing:export")).toBe(true);
  });

  it("allows users:manage", () => {
    expect(can("owner", "users:manage")).toBe(true);
  });

  it("allows unknown permissions (owner has all access)", () => {
    expect(can("owner", "nonexistent:action")).toBe(true);
  });
});

// ── Manager role ──────────────────────────────────────────────────────────────

describe("can() — manager role", () => {
  it("allows financing:read", () => {
    expect(can("manager", "financing:read")).toBe(true);
  });

  it("allows financing:write", () => {
    expect(can("manager", "financing:write")).toBe(true);
  });

  it("allows financing:export", () => {
    expect(can("manager", "financing:export")).toBe(true);
  });

  it("denies financing:delete", () => {
    expect(can("manager", "financing:delete")).toBe(false);
  });

  it("denies users:manage", () => {
    expect(can("manager", "users:manage")).toBe(false);
  });

  it("denies unknown permission", () => {
    expect(can("manager", "inventory:delete")).toBe(false);
  });
});

// ── Staff role ────────────────────────────────────────────────────────────────

describe("can() — staff role", () => {
  it("allows financing:read", () => {
    expect(can("staff", "financing:read")).toBe(true);
  });

  it("denies financing:write", () => {
    expect(can("staff", "financing:write")).toBe(false);
  });

  it("denies financing:delete", () => {
    expect(can("staff", "financing:delete")).toBe(false);
  });

  it("denies financing:export", () => {
    expect(can("staff", "financing:export")).toBe(false);
  });

  it("denies users:manage", () => {
    expect(can("staff", "users:manage")).toBe(false);
  });
});

// ── DMS: admin role ───────────────────────────────────────────────────────────

describe("can() — admin role (DMS)", () => {
  it("allows vehicles:read", () => {
    expect(can("admin", "vehicles:read")).toBe(true);
  });

  it("allows vehicles:write", () => {
    expect(can("admin", "vehicles:write")).toBe(true);
  });

  it("allows vehicles:delete", () => {
    expect(can("admin", "vehicles:delete")).toBe(true);
  });

  it("allows dealer:users:manage", () => {
    expect(can("admin", "dealer:users:manage")).toBe(true);
  });

  it("allows commission:assign", () => {
    expect(can("admin", "commission:assign")).toBe(true);
  });

  it("allows garage:write", () => {
    expect(can("admin", "garage:write")).toBe(true);
  });

  it("allows vehicles:import", () => {
    expect(can("admin", "vehicles:import")).toBe(true);
  });

  it("allows financing:read (financing permissions extend to admin)", () => {
    expect(can("admin", "financing:read")).toBe(true);
  });

  it("allows unknown permissions (admin has all access)", () => {
    expect(can("admin", "nonexistent:action")).toBe(true);
  });
});

// ── DMS: sales role ───────────────────────────────────────────────────────────

describe("can() — sales role (DMS)", () => {
  it("allows vehicles:read", () => {
    expect(can("sales", "vehicles:read")).toBe(true);
  });

  it("allows vehicles:write", () => {
    expect(can("sales", "vehicles:write")).toBe(true);
  });

  it("denies vehicles:delete", () => {
    expect(can("sales", "vehicles:delete")).toBe(false);
  });

  it("denies dealer:users:manage", () => {
    expect(can("sales", "dealer:users:manage")).toBe(false);
  });

  it("allows commission:assign", () => {
    expect(can("sales", "commission:assign")).toBe(true);
  });

  it("allows garage:read", () => {
    expect(can("sales", "garage:read")).toBe(true);
  });

  it("denies garage:write", () => {
    expect(can("sales", "garage:write")).toBe(false);
  });

  it("allows vehicles:import", () => {
    expect(can("sales", "vehicles:import")).toBe(true);
  });

  it("denies unknown permissions", () => {
    expect(can("sales", "nonexistent:action")).toBe(false);
  });
});

// ── Undefined / missing role ──────────────────────────────────────────────────

describe("can() — undefined role", () => {
  it("denies every permission when role is undefined", () => {
    expect(can(undefined, "financing:read")).toBe(false);
    expect(can(undefined, "financing:write")).toBe(false);
    expect(can(undefined, "users:manage")).toBe(false);
    expect(can(undefined, "vehicles:read")).toBe(false);
    expect(can(undefined, "dealer:users:manage")).toBe(false);
  });
});
