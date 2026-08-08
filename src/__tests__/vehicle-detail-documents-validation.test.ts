import { describe, it, expect } from "vitest";
import { validateDocumentForm } from "../components/admin/VehicleDetail";

function baseForm(overrides: Partial<{ type: string; description: string; file: unknown }> = {}) {
  return {
    type: "warranty",
    description: "Extended warranty document",
    file: {},
    ...overrides,
  };
}

describe("validateDocumentForm", () => {
  it("accepts a fully valid form", () => {
    expect(validateDocumentForm(baseForm())).toEqual({});
  });

  it("accepts a missing description (optional)", () => {
    expect(validateDocumentForm(baseForm({ description: "" })).description).toBeFalsy();
  });

  it("rejects a missing document type", () => {
    expect(validateDocumentForm(baseForm({ type: "" })).document_type).toBeTruthy();
  });

  it("rejects a missing file", () => {
    expect(validateDocumentForm(baseForm({ file: null })).file).toBeTruthy();
  });
});
