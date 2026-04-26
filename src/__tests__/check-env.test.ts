import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkEnvIntegration } from "../lib/check-env";

describe("checkEnvIntegration", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  const ALL_VARS = [
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "RESEND_API_KEY",
    "RESEND_FROM_ADDRESS",
    "RESEND_DEALER_EMAIL",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ];

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // ── Integration shape ─────────────────────────────────────────────────────

  it("returns an Astro integration named 'check-env'", () => {
    const integration = checkEnvIntegration();
    expect(integration.name).toBe("check-env");
  });

  it("exposes astro:server:start and astro:build:start hooks", () => {
    const { hooks } = checkEnvIntegration();
    expect(typeof hooks["astro:server:start"]).toBe("function");
    expect(typeof hooks["astro:build:start"]).toBe("function");
  });

  // ── server:start (non-fatal) ───────────────────────────────────────────────

  describe("astro:server:start hook (non-fatal)", () => {
    it("calls console.warn when env vars are missing", () => {
      ALL_VARS.forEach((k) => vi.stubEnv(k, ""));
      checkEnvIntegration().hooks["astro:server:start"]!();
      // Now warns separately about optional + required
      expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it("warns about missing required variables", () => {
      ALL_VARS.forEach((k) => vi.stubEnv(k, ""));
      checkEnvIntegration().hooks["astro:server:start"]!();
      const allMsg = warnSpy.mock.calls.map(c => c[0]).join("\n");
      // Required vars should appear in warnings
      expect(allMsg).toContain("SUPABASE_URL");
      expect(allMsg).toContain("RESEND_API_KEY");
    });

    it("does not warn when all env vars are present", () => {
      ALL_VARS.forEach((k) => vi.stubEnv(k, "some_value"));
      checkEnvIntegration().hooks["astro:server:start"]!();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("only warns about missing vars, not present ones", () => {
      ALL_VARS.forEach((k) => vi.stubEnv(k, "some_value"));
      vi.stubEnv("RESEND_API_KEY", ""); // knock out one required var
      checkEnvIntegration().hooks["astro:server:start"]!();
      const allMsg = warnSpy.mock.calls.map(c => c[0]).join("\n");
      expect(allMsg).toContain("RESEND_API_KEY");
      expect(allMsg).not.toContain("SUPABASE_URL"); // present — should not appear
    });

    it("does not throw even when env vars are missing", () => {
      ALL_VARS.forEach((k) => vi.stubEnv(k, ""));
      expect(() =>
        checkEnvIntegration().hooks["astro:server:start"]!()
      ).not.toThrow();
    });
  });

  // ── build:start (fatal) ───────────────────────────────────────────────────

  describe("astro:build:start hook (fatal)", () => {
    it("throws when required env vars are missing", () => {
      ALL_VARS.forEach((k) => vi.stubEnv(k, ""));
      expect(() =>
        checkEnvIntegration().hooks["astro:build:start"]!()
      ).toThrow(/missing required env vars/i);
    });

    it("throw message includes the missing variable names", () => {
      ALL_VARS.forEach((k) => vi.stubEnv(k, "some_value"));
      vi.stubEnv("SUPABASE_SECRET_KEY", "");
      vi.stubEnv("RESEND_API_KEY", "");
      let message = "";
      try {
        checkEnvIntegration().hooks["astro:build:start"]!();
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toContain("SUPABASE_SECRET_KEY");
      expect(message).toContain("RESEND_API_KEY");
      expect(message).not.toContain("SUPABASE_URL"); // present — should not appear
    });

    it("does not throw when all required env vars are present (optional can be missing)", () => {
      const requiredVars = [
        "SUPABASE_URL",
        "SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_SECRET_KEY",
        "RESEND_API_KEY",
        "RESEND_FROM_ADDRESS",
        "RESEND_DEALER_EMAIL",
      ];
      requiredVars.forEach((k) => vi.stubEnv(k, "some_value"));
      // Don't set UPSTASH vars (optional) — should not throw
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
      expect(() =>
        checkEnvIntegration().hooks["astro:build:start"]!()
      ).not.toThrow();
    });

    it("warns about optional vars but doesn't fail build", () => {
      const requiredVars = [
        "SUPABASE_URL",
        "SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_SECRET_KEY",
        "RESEND_API_KEY",
        "RESEND_FROM_ADDRESS",
        "RESEND_DEALER_EMAIL",
      ];
      requiredVars.forEach((k) => vi.stubEnv(k, "some_value"));
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
      checkEnvIntegration().hooks["astro:build:start"]!();
      // Should warn about optional vars but not throw
      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0][0]).toContain("Optional");
    });
  });
});
