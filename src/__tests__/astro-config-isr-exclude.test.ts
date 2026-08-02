import { describe, it, expect } from "vitest";
import { ISR_EXCLUDE } from "../../astro.config.mjs";

/**
 * Regression test for the admin-page auto-reload/sign-out loop: Vercel's ISR
 * function caches any route not in `isr.exclude` for `isr.expiration`
 * (3 hours), independent of the app's own Cache-Control header. Admin routes
 * set Cache-Control: no-store themselves (see middleware.ts) but that alone
 * does not stop edge caching — a cached admin response (including rotated
 * Set-Cookie session tokens from a token refresh) gets replayed to later
 * requests, which fails re-validation and loops. See astro.config.mjs
 * `isr.exclude`.
 */
describe("astro.config.mjs ISR_EXCLUDE", () => {
  const exclude = ISR_EXCLUDE;

  const adminPaths = [
    "/admin",
    "/admin/",
    "/admin/dashboard/",
    "/admin/inventory/",
    "/admin/signout/",
    "/admin/callback/",
  ];

  it.each(adminPaths)("excludes %s from ISR caching", (path) => {
    expect(exclude.some((re) => re.test(path))).toBe(true);
  });

  it("does not exclude unrelated static paths", () => {
    expect(exclude.some((re) => re.test("/administrator-guide/"))).toBe(false);
    expect(exclude.some((re) => re.test("/blog/"))).toBe(false);
  });

  it("still excludes /api/ routes", () => {
    expect(exclude.some((re) => re.test("/api/vehicles"))).toBe(true);
  });
});
