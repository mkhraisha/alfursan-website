import { vi, describe, it, expect } from "vitest";

vi.mock("astro:middleware", () => ({
  defineMiddleware: (fn: unknown) => fn,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({})),
}));

import { buildConnectSrc } from "../middleware";

/**
 * Regression test: the admin CSP's connect-src was hardcoded to `'self' https:`,
 * so the browser blocked fetches to a local Supabase stack (e.g.
 * http://127.0.0.1:54321), which is plain HTTP. Dev must allow that exact origin;
 * production must stay locked to https: only.
 */
describe("buildConnectSrc", () => {
  it("stays https-only in production regardless of SUPABASE_URL", () => {
    expect(buildConnectSrc(false, "http://127.0.0.1:54321")).toBe("'self' https:");
  });

  it("adds the local Supabase origin in dev when it's plain HTTP", () => {
    expect(buildConnectSrc(true, "http://127.0.0.1:54321")).toBe(
      "'self' https: http://127.0.0.1:54321"
    );
  });

  it("does not duplicate an https SUPABASE_URL in dev", () => {
    expect(buildConnectSrc(true, "https://test.supabase.co")).toBe("'self' https:");
  });

  it("falls back to the default sources on an invalid/missing SUPABASE_URL in dev", () => {
    expect(buildConnectSrc(true, "")).toBe("'self' https:");
  });
});
