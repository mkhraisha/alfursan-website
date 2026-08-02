import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Regression test for a production incident: @astrojs/vercel's isr.exclude
 * route-regex generation built each excluded route's Vercel routing regex via
 * escapeRegex(route.pattern) instead of Astro's own precompiled
 * route.patternRegex.source, silently dropping the optional trailing-slash
 * group Astro normally compiles in (per `trailingSlash: "ignore"`). Every
 * /admin/** and /api/** route is excluded from ISR (see astro.config.mjs
 * ISR_EXCLUDE) and was affected — a request to e.g. /admin/dashboard/ (the
 * app's own convention; see AdminLayout's window.location.replace calls)
 * fell through to Vercel's catch-all 404 route instead of reaching the page.
 *
 * This only manifests in the actual built Vercel output — `astro dev` (which
 * the e2e suite runs against, see playwright.config.ts) has its own routing
 * and never exercises the adapter's route generation, so the e2e suite could
 * not have caught it. Patched in patches/@astrojs+vercel+11.0.3.patch.
 *
 * Requires `npm run build` to have already produced
 * .vercel/output/config.json (as CI does before running `npm test`);
 * self-skips otherwise so a bare `npm test` locally still passes.
 */
const CONFIG_PATH = path.resolve(process.cwd(), ".vercel/output/config.json");
const configExists = existsSync(CONFIG_PATH);

describe.skipIf(!configExists)("Vercel output route regexes (.vercel/output/config.json)", () => {
  const config = configExists ? JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) : { routes: [] };
  const routes: Array<{ src?: string }> = config.routes ?? [];
  const adminAndApiRoutes = routes.filter(
    (r) => typeof r.src === "string" && (r.src.startsWith("^/admin") || r.src.startsWith("^/api")),
  );

  it("found admin and api routes to check", () => {
    expect(adminAndApiRoutes.length).toBeGreaterThan(0);
  });

  it.each(adminAndApiRoutes.map((r) => r.src as string))(
    "%s tolerates a trailing slash",
    (src) => {
      expect(src.endsWith("/?$")).toBe(true);
    },
  );
});
