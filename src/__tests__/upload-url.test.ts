import { describe, it, expect } from "vitest";

// UUID validation regex — must match what upload-url.ts uses
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("upload-url draftId UUID validation", () => {
  it("accepts a valid lowercase UUID v4", () => {
    expect(UUID_RE.test("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("accepts a valid uppercase UUID", () => {
    expect(UUID_RE.test("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejects a path traversal attempt", () => {
    expect(UUID_RE.test("../../etc/passwd")).toBe(false);
  });

  it("rejects a short id", () => {
    expect(UUID_RE.test("abc123")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(UUID_RE.test("")).toBe(false);
  });

  it("rejects a UUID with extra characters", () => {
    expect(UUID_RE.test("550e8400-e29b-41d4-a716-446655440000-extra")).toBe(false);
  });

  it("rejects a UUID with wrong separator", () => {
    expect(UUID_RE.test("550e8400_e29b_41d4_a716_446655440000")).toBe(false);
  });

  it("rejects null byte injection", () => {
    expect(UUID_RE.test("550e8400-e29b-41d4-a716-446655440000\0")).toBe(false);
  });
});
