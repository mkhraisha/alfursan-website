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
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0][0]).toMatch(/missing environment variables/i);
    });

    it("lists all missing variable names in the warning", () => {
      ALL_VARS.forEach((k) => vi.stubEnv(k, ""));
      checkEnvIntegration().hooks["astro:server:start"]!();
      const msg = warnSpy.mock.calls[0][0] as string;
      for (const key of ALL_VARS) {
        expect(msg).toContain(key);
      }
    });

    it("does not warn when all env vars are present", () => {
      ALL_VARS.forEach((k) => vi.stubEnv(k, "some_value"));
      checkEnvIntegration().hooks["astro:server:start"]!();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("only warns about missing vars, not present ones", () => {
      ALL_VARS.forEach((k) => vi.stubEnv(k, "some_value"));
      vi.stubEnv("RESEND_API_KEY", ""); // knock out one
      checkEnvIntegration().hooks["astro:server:start"]!();
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0][0]).toContain("RESEND_API_KEY");
      expect(warnSpy.mock.calls[0][0]).not.toContain("SUPABASE_URL");
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
    it("throws when env vars are missing", () => {
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

    it("does not throw when all env vars are present", () => {
      ALL_VARS.forEach((k) => vi.stubEnv(k, "some_value"));
      expect(() =>
        checkEnvIntegration().hooks["astro:build:start"]!()
      ).not.toThrow();
    });

    it("does not call console.warn (fatal path uses throw, not warn)", () => {
      ALL_VARS.forEach((k) => vi.stubEnv(k, ""));
      try {
        checkEnvIntegration().hooks["astro:build:start"]!();
      } catch {
        // expected
      }
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
