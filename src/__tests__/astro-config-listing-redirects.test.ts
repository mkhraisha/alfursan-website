import { describe, it, expect } from "vitest";
import { LISTING_REDIRECTS } from "../../astro.config.mjs";
import wpListingRedirects from "../data/wp-listing-redirects.json";

/**
 * Regression coverage for the old WordPress vehicle-listing slug -> new
 * VIN-based route redirects (WordPress migration Part 5, decision: keep a
 * static slug->VIN lookup table so old inbound links 301 instead of 404ing).
 */
describe("astro.config.mjs LISTING_REDIRECTS", () => {
  it("maps every captured WP slug to /listing/{slug}/ -> /listing/{vin}/", () => {
    const entries = Object.entries(wpListingRedirects as Record<string, string>);
    expect(entries.length).toBeGreaterThan(0);

    for (const [slug, vin] of entries) {
      expect(LISTING_REDIRECTS[`/listing/${slug}/`]).toBe(`/listing/${vin}/`);
    }
  });

  it("has exactly as many entries as the source data file", () => {
    expect(Object.keys(LISTING_REDIRECTS).length).toBe(
      Object.keys(wpListingRedirects).length,
    );
  });

  it("every redirect target is a 17-character VIN-shaped path", () => {
    for (const target of Object.values(LISTING_REDIRECTS)) {
      const vin = target.replace(/^\/listing\//, "").replace(/\/$/, "");
      expect(vin).toMatch(/^[A-HJ-NPR-Z0-9]{17}$/);
    }
  });
});
