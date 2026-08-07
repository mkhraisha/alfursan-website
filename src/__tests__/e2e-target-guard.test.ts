import { describe, it, expect, vi, afterEach } from "vitest";
import { assertLocalE2ETarget } from "../lib/e2e-target-guard";

describe("assertLocalE2ETarget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows localhost regardless of CI/allowNonLocal", () => {
    expect(() =>
      assertLocalE2ETarget("http://localhost:4321", { isCI: false, allowNonLocal: false })
    ).not.toThrow();
    expect(() =>
      assertLocalE2ETarget("http://localhost:4321", { isCI: true, allowNonLocal: false })
    ).not.toThrow();
  });

  it("allows 127.0.0.1 regardless of CI/allowNonLocal", () => {
    expect(() =>
      assertLocalE2ETarget("http://127.0.0.1:3000", { isCI: false, allowNonLocal: false })
    ).not.toThrow();
  });

  it("throws on an invalid E2E_BASE_URL", () => {
    expect(() =>
      assertLocalE2ETarget("not-a-url", { isCI: false, allowNonLocal: false })
    ).toThrow(/Invalid E2E_BASE_URL/);
  });

  it("throws on a non-local target under CI, even with allowNonLocal set", () => {
    expect(() =>
      assertLocalE2ETarget("https://alfursanauto.ca", { isCI: true, allowNonLocal: true })
    ).toThrow(/Refusing to run the e2e suite.*under CI/s);
  });

  it("throws on a non-local target locally when allowNonLocal is not set", () => {
    expect(() =>
      assertLocalE2ETarget("https://alfursanauto.ca", { isCI: false, allowNonLocal: false })
    ).toThrow(/E2E_ALLOW_NON_LOCAL/);
  });

  it("allows a non-local target locally when allowNonLocal is explicitly set, with a warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      assertLocalE2ETarget("https://preview.alfursanauto.ca", { isCI: false, allowNonLocal: true })
    ).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("NON-LOCAL target"));
  });
});
