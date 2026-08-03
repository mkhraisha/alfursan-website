import { vi, describe, it, expect } from "vitest";

vi.mock("astro:middleware", () => ({
  defineMiddleware: (fn: unknown) => fn,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({})),
}));

import { buildImgSrc } from "../middleware";

/**
 * Regression test: the public CSP's img-src was hardcoded to `'self' data: https:`,
 * so the browser blocked loading vehicle photos from a local Supabase stack
 * (e.g. http://127.0.0.1:54321/storage/v1/object/public/vehicle-images/...),
 * which is plain HTTP — surfaced by the WordPress migration Part 5 pages
 * rendering vehicle images straight from Supabase Storage. Same fix shape as
 * buildConnectSrc: dev must allow that exact origin; production stays
 * locked to https: only.
 */
describe("buildImgSrc", () => {
  it("stays https-only in production regardless of SUPABASE_URL", () => {
    expect(buildImgSrc(false, "http://127.0.0.1:54321")).toBe("'self' data: https:");
  });

  it("adds the local Supabase origin in dev when it's plain HTTP", () => {
    expect(buildImgSrc(true, "http://127.0.0.1:54321")).toBe(
      "'self' data: https: http://127.0.0.1:54321"
    );
  });

  it("does not duplicate an https SUPABASE_URL in dev", () => {
    expect(buildImgSrc(true, "https://test.supabase.co")).toBe("'self' data: https:");
  });

  it("falls back to the default sources on an invalid/missing SUPABASE_URL in dev", () => {
    expect(buildImgSrc(true, "")).toBe("'self' data: https:");
  });
});
