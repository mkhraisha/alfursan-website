import { describe, it, expect } from "vitest";
import { LEGACY_HOME_REDIRECTS as LEGACY_HOME_REDIRECTS_UNTYPED } from "../../astro.config.mjs";

const LEGACY_HOME_REDIRECTS: Record<string, string> =
  LEGACY_HOME_REDIRECTS_UNTYPED;

/**
 * Regression coverage for WordPress migration Part 7 (decommission blog,
 * team, FAQ): legacy blog post/taxonomy links and the old "/meet-the-team/"
 * alias used to chain to /blog/ or /our-team/, which no longer exist now that
 * those pages are deleted. They must redirect straight home instead.
 */
describe("astro.config.mjs LEGACY_HOME_REDIRECTS", () => {
  it("redirects every legacy blog/team path to the homepage", () => {
    const paths = [
      "/meet-the-team/",
      "/14-surprisingly-affordable-luxury-cars/",
      "/how-close-are-we-to-autonomous-cars/",
      "/category/auto-detailing/",
      "/category/car-news/",
      "/category/car-reviews/",
      "/tag/premium/",
      "/tag/sedan/",
      "/tag/sport/",
      "/tag/speed/",
      "/tag/suv/",
      "/tag/supercars/",
    ];

    for (const path of paths) {
      expect(LEGACY_HOME_REDIRECTS[path]).toBe("/");
    }
  });

  it("never redirects to a /blog/ or /our-team/ path", () => {
    for (const target of Object.values(LEGACY_HOME_REDIRECTS)) {
      expect(target).not.toMatch(/^\/blog\//);
      expect(target).not.toMatch(/^\/our-team\//);
    }
  });
});
