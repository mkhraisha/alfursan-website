import { describe, it, expect } from "vitest";
import { can } from "../lib/permissions";

// ── Owner (implicit all-access) ───────────────────────────────────────────────

describe("can() — owner role", () => {
  it("allows vehicles:read", () => {
    expect(can("owner", "vehicles:read")).toBe(true);
  });

  it("allows vehicles:create", () => {
    expect(can("owner", "vehicles:create")).toBe(true);
  });

  it("allows vehicles:write", () => {
    expect(can("owner", "vehicles:write")).toBe(true);
  });

  it("allows vehicles:delete", () => {
    expect(can("owner", "vehicles:delete")).toBe(true);
  });

  it("allows vehicles:pricing:write", () => {
    expect(can("owner", "vehicles:pricing:write")).toBe(true);
  });

  it("allows vehicles:media:write", () => {
    expect(can("owner", "vehicles:media:write")).toBe(true);
  });

  it("allows vehicles:financials:read", () => {
    expect(can("owner", "vehicles:financials:read")).toBe(true);
  });

  it("allows dealer:users:manage", () => {
    expect(can("owner", "dealer:users:manage")).toBe(true);
  });

  it("allows vehicles:import", () => {
    expect(can("owner", "vehicles:import")).toBe(true);
  });

  it("allows financing:delete (owner-only)", () => {
    expect(can("owner", "financing:delete")).toBe(true);
  });

  it("allows unknown permissions (owner has all access)", () => {
    expect(can("owner", "nonexistent:action")).toBe(true);
  });
});

// ── Manager role ──────────────────────────────────────────────────────────────

describe("can() — manager role", () => {
  it("allows vehicles:read", () => {
    expect(can("manager", "vehicles:read")).toBe(true);
  });

  it("allows vehicles:create", () => {
    expect(can("manager", "vehicles:create")).toBe(true);
  });

  it("allows vehicles:write", () => {
    expect(can("manager", "vehicles:write")).toBe(true);
  });

  it("allows vehicles:delete", () => {
    expect(can("manager", "vehicles:delete")).toBe(true);
  });

  it("allows vehicles:pricing:write", () => {
    expect(can("manager", "vehicles:pricing:write")).toBe(true);
  });

  it("allows vehicles:media:write", () => {
    expect(can("manager", "vehicles:media:write")).toBe(true);
  });

  it("allows vehicles:financials:read", () => {
    expect(can("manager", "vehicles:financials:read")).toBe(true);
  });

  it("allows commission:assign", () => {
    expect(can("manager", "commission:assign")).toBe(true);
  });

  it("allows dealer:users:manage", () => {
    expect(can("manager", "dealer:users:manage")).toBe(true);
  });

  it("allows garage:read", () => {
    expect(can("manager", "garage:read")).toBe(true);
  });

  it("allows garage:write", () => {
    expect(can("manager", "garage:write")).toBe(true);
  });

  it("allows vehicles:import", () => {
    expect(can("manager", "vehicles:import")).toBe(true);
  });

  it("allows financing:read", () => {
    expect(can("manager", "financing:read")).toBe(true);
  });

  it("allows financing:write", () => {
    expect(can("manager", "financing:write")).toBe(true);
  });

  it("allows financing:export", () => {
    expect(can("manager", "financing:export")).toBe(true);
  });

  it("denies financing:delete (owner only)", () => {
    expect(can("manager", "financing:delete")).toBe(false);
  });

  it("denies users:manage (owner only)", () => {
    expect(can("manager", "users:manage")).toBe(false);
  });

  it("denies unknown permissions", () => {
    expect(can("manager", "nonexistent:action")).toBe(false);
  });
});

// ── Sales Representative role ─────────────────────────────────────────────────

describe("can() — sales role (Sales Representative)", () => {
  it("allows vehicles:read", () => {
    expect(can("sales", "vehicles:read")).toBe(true);
  });

  it("allows vehicles:write (non-restricted field updates)", () => {
    expect(can("sales", "vehicles:write")).toBe(true);
  });

  it("denies vehicles:create (cannot add vehicles)", () => {
    expect(can("sales", "vehicles:create")).toBe(false);
  });

  it("denies vehicles:delete", () => {
    expect(can("sales", "vehicles:delete")).toBe(false);
  });

  it("denies vehicles:pricing:write (cannot modify pricing)", () => {
    expect(can("sales", "vehicles:pricing:write")).toBe(false);
  });

  it("denies vehicles:media:write (cannot modify media)", () => {
    expect(can("sales", "vehicles:media:write")).toBe(false);
  });

  it("denies vehicles:financials:read (cannot view profit/loss)", () => {
    expect(can("sales", "vehicles:financials:read")).toBe(false);
  });

  it("allows commission:assign", () => {
    expect(can("sales", "commission:assign")).toBe(true);
  });

  it("denies dealer:users:manage", () => {
    expect(can("sales", "dealer:users:manage")).toBe(false);
  });

  it("allows garage:read", () => {
    expect(can("sales", "garage:read")).toBe(true);
  });

  it("denies garage:write", () => {
    expect(can("sales", "garage:write")).toBe(false);
  });

  it("denies vehicles:import (creates vehicles)", () => {
    expect(can("sales", "vehicles:import")).toBe(false);
  });

  it("allows financing:read", () => {
    expect(can("sales", "financing:read")).toBe(true);
  });

  it("denies financing:write", () => {
    expect(can("sales", "financing:write")).toBe(false);
  });

  it("denies financing:delete", () => {
    expect(can("sales", "financing:delete")).toBe(false);
  });

  it("denies financing:export", () => {
    expect(can("sales", "financing:export")).toBe(false);
  });

  it("denies unknown permissions", () => {
    expect(can("sales", "nonexistent:action")).toBe(false);
  });
});

// ── Undefined / missing role ──────────────────────────────────────────────────

describe("can() — undefined role", () => {
  it("denies every permission when role is undefined", () => {
    expect(can(undefined, "vehicles:read")).toBe(false);
    expect(can(undefined, "vehicles:create")).toBe(false);
    expect(can(undefined, "vehicles:pricing:write")).toBe(false);
    expect(can(undefined, "vehicles:financials:read")).toBe(false);
    expect(can(undefined, "dealer:users:manage")).toBe(false);
    expect(can(undefined, "financing:read")).toBe(false);
  });
});
