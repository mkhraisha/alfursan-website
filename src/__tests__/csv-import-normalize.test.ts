import { describe, it, expect } from "vitest";

// Mirrors the normalization helpers in src/pages/api/vehicles/import.ts

function normalizeEnum(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s\-]+/g, "_");
}

function normalizeOwnershipStatus(raw: string): string {
  const norm = normalizeEnum(raw);
  if (norm.startsWith("en_route") || norm.startsWith("en route")) return "en_route";
  return norm;
}

function parsePrice(raw: string): number | null {
  const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
}

function parseInteger(raw: string): number | null {
  const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? null : n;
}

// ── normalizeEnum ─────────────────────────────────────────────────────────────

describe("normalizeEnum (status / photography_status)", () => {
  it("lowercases plain value", () => {
    expect(normalizeEnum("Sold")).toBe("sold");
  });

  it("converts spaces to underscores", () => {
    expect(normalizeEnum("Frontline Ready")).toBe("frontline_ready");
  });

  it("converts hyphens to underscores", () => {
    expect(normalizeEnum("on-lot-work-needed")).toBe("on_lot_work_needed");
  });

  it("handles ALL CAPS", () => {
    expect(normalizeEnum("IN DEAL")).toBe("in_deal");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeEnum("  sold  ")).toBe("sold");
  });

  it("photography — Done", () => {
    expect(normalizeEnum("Done")).toBe("done");
  });

  it("photography — Pending", () => {
    expect(normalizeEnum("Pending")).toBe("pending");
  });

  it("photography — already lowercase", () => {
    expect(normalizeEnum("na")).toBe("na");
  });
});

// ── normalizeOwnershipStatus ──────────────────────────────────────────────────

describe("normalizeOwnershipStatus", () => {
  it("Available → available", () => {
    expect(normalizeOwnershipStatus("Available")).toBe("available");
  });

  it("available → available", () => {
    expect(normalizeOwnershipStatus("available")).toBe("available");
  });

  it("AVAILABLE → available", () => {
    expect(normalizeOwnershipStatus("AVAILABLE")).toBe("available");
  });

  it("Not Received → not_received", () => {
    expect(normalizeOwnershipStatus("Not Received")).toBe("not_received");
  });

  it("not_received → not_received", () => {
    expect(normalizeOwnershipStatus("not_received")).toBe("not_received");
  });

  it("En Route → en_route", () => {
    expect(normalizeOwnershipStatus("En Route")).toBe("en_route");
  });

  it("en_route → en_route", () => {
    expect(normalizeOwnershipStatus("en_route")).toBe("en_route");
  });

  it("En Route from OpenLane → en_route", () => {
    expect(normalizeOwnershipStatus("En Route from OpenLane")).toBe("en_route");
  });

  it("EN ROUTE FROM OPENLANE → en_route", () => {
    expect(normalizeOwnershipStatus("EN ROUTE FROM OPENLANE")).toBe("en_route");
  });

  it("en-route → en_route", () => {
    expect(normalizeOwnershipStatus("en-route")).toBe("en_route");
  });
});

// ── parsePrice ────────────────────────────────────────────────────────────────

describe("parsePrice (currency field normalization)", () => {
  it("plain number", () => {
    expect(parsePrice("45000")).toBe(45000);
  });

  it("CA$ prefix with commas — CA$1,234.56", () => {
    expect(parsePrice("CA$1,234.56")).toBeCloseTo(1234.56);
  });

  it("$ prefix — $45,000.00", () => {
    expect(parsePrice("$45,000.00")).toBeCloseTo(45000);
  });

  it("commas only — 45,000", () => {
    expect(parsePrice("45,000")).toBe(45000);
  });

  it("no formatting — 1234.56", () => {
    expect(parsePrice("1234.56")).toBeCloseTo(1234.56);
  });
});

// ── parseInteger (odometer) ───────────────────────────────────────────────────

describe("parseInteger (odometer with commas)", () => {
  it("plain number", () => {
    expect(parseInteger("85000")).toBe(85000);
  });

  it("comma-formatted — 85,000", () => {
    expect(parseInteger("85,000")).toBe(85000);
  });

  it("large odometer — 123,456", () => {
    expect(parseInteger("123,456")).toBe(123456);
  });

  it("strips non-digit characters", () => {
    expect(parseInteger("85 000 km")).toBe(85000);
  });
});
