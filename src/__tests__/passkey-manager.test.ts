import { describe, it, expect } from "vitest";
import { fmtDate } from "../components/admin/PasskeyManager";

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
