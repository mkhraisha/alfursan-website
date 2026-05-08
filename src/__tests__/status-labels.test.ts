import { describe, it, expect } from "vitest";
import { formatStatusLabel } from "../lib/status-labels";

describe("formatStatusLabel", () => {
  it("returns known mapped labels", () => {
    expect(formatStatusLabel("new")).toBe("New");
    expect(formatStatusLabel("reviewing")).toBe("Reviewing");
    expect(formatStatusLabel("approved")).toBe("Approved");
    expect(formatStatusLabel("declined")).toBe("Declined");
    expect(formatStatusLabel("document_incomplete")).toBe("Documents Incomplete");
    expect(formatStatusLabel("documents_submitted")).toBe("Documents Submitted");
  });

  it("passes through unknown statuses unchanged", () => {
    expect(formatStatusLabel("in_progress")).toBe("in_progress");
  });
});
