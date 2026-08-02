import { describe, it, expect } from "vitest";
import { fmtDate, parsePasskeyListResult } from "../components/admin/PasskeyManager";

describe("fmtDate", () => {
  it("formats an ISO timestamp as a short date", () => {
    expect(fmtDate("2026-05-01T12:00:00Z")).toBe(
      new Date("2026-05-01T12:00:00Z").toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })
    );
  });

  it("returns 'Never' for undefined (passkey never used)", () => {
    expect(fmtDate(undefined)).toBe("Never");
  });
});

describe("parsePasskeyListResult", () => {
  it("returns the passkey list on success", () => {
    const passkeys = [{ id: "1", created_at: "2026-05-01T00:00:00Z" }];
    expect(parsePasskeyListResult({ data: passkeys, error: null })).toEqual({
      passkeys,
      error: null,
    });
  });

  it("returns an empty list when data is null (no error)", () => {
    expect(parsePasskeyListResult({ data: null, error: null })).toEqual({
      passkeys: [],
      error: null,
    });
  });

  it("returns an empty list and the error message on failure", () => {
    expect(
      parsePasskeyListResult({ data: null, error: { message: "passkeys not enabled" } })
    ).toEqual({ passkeys: [], error: "passkeys not enabled" });
  });

  it("falls back to a generic message when the error has no message", () => {
    expect(parsePasskeyListResult({ data: null, error: {} })).toEqual({
      passkeys: [],
      error: "Failed to load passkeys",
    });
  });
});
