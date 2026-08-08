/**
 * Helper for purging Vercel's CDN edge cache by tag.
 *
 * The only actual CDN-cacheable, purgeable response in this app is the
 * unauthenticated branch of GET /api/vehicles (src/pages/api/vehicles/index.ts),
 * which sets `Cache-Control: public, max-age=300` and a `Vercel-Cache-Tag`
 * response header. The public Astro pages (/, /search, /sold, /listing/[vin])
 * are SSR'd directly against the DB per-request and are excluded from
 * Vercel's ISR edge cache entirely (see ISR_EXCLUDE in astro.config.mjs) —
 * they're already always fresh, so there's nothing to purge for them.
 *
 * API reference: https://vercel.com/docs/rest-api/reference/endpoints/edge-cache
 *   POST https://api.vercel.com/v1/edge-cache/invalidate-by-tags
 *   Auth: Authorization: Bearer <token>
 *   Query: projectIdOrName (required), teamId (optional)
 *   Body: { tags: string | string[], target?: "production" | "preview" }
 *   Limits: 256 chars/tag, 128 tags/cached response, 16 tags per bulk call.
 */

// Tag applied to GET /api/vehicles' public response — the only argument this
// module currently needs to pass to Vercel's purge API.
export const PUBLIC_VEHICLES_CACHE_TAG = "public-vehicles";

export interface VercelPurgeRequest {
  url: string;
  headers: Record<string, string>;
  body: { tags: string[]; target?: "production" | "preview" };
}

/**
 * Pure request-builder — separated from the actual fetch() call so it can be
 * unit-tested without hitting the network.
 */
export function buildPurgeRequest(opts: {
  tags: string[];
  token: string;
  projectId: string;
  teamId?: string;
  target?: "production" | "preview";
}): VercelPurgeRequest {
  const params = new URLSearchParams({ projectIdOrName: opts.projectId });
  if (opts.teamId) params.set("teamId", opts.teamId);

  return {
    url: `https://api.vercel.com/v1/edge-cache/invalidate-by-tags?${params.toString()}`,
    headers: {
      Authorization: `Bearer ${opts.token}`,
      "Content-Type": "application/json",
    },
    body: {
      tags: opts.tags,
      ...(opts.target ? { target: opts.target } : {}),
    },
  };
}

export type PurgeResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" }
  | { ok: false; reason: "disabled_in_ci" }
  | { ok: false; reason: "request_failed"; status: number; body: string };

/**
 * Invalidates the given tags on Vercel's edge cache. Reads its Vercel API
 * credentials from process.env directly (VERCEL_API_TOKEN / VERCEL_PROJECT_ID
 * / VERCEL_TEAM_ID) rather than taking them as parameters — these are
 * optional in local/dev environments (see check-env.ts's OPTIONAL_ENV), so
 * this gracefully reports "not_configured" instead of throwing when absent.
 *
 * Refuses to run under `CI` (the same env var Playwright's own config keys
 * off — see playwright.config.ts), regardless of whether Vercel credentials
 * happen to be set there. Unlike the DB-backed admin actions the e2e suite
 * otherwise exercises against a disposable local Supabase stack, there is no
 * "local" Vercel to purge against — a live token in CI would mean an
 * automated test run could actually invalidate the production CDN cache.
 * This check is deliberately the first thing this function does, ahead of
 * even the not_configured check, so it can't be bypassed by a future caller
 * (e2e test or otherwise) that happens to run with real credentials set.
 */
export async function purgeVercelCache(
  tags: string[],
  target: "production" | "preview" = "production"
): Promise<PurgeResult> {
  if (process.env.CI) {
    return { ok: false, reason: "disabled_in_ci" };
  }

  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) {
    return { ok: false, reason: "not_configured" };
  }

  const req = buildPurgeRequest({ tags, token, projectId, teamId, target });

  const res = await fetch(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify(req.body),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, reason: "request_failed", status: res.status, body };
  }

  return { ok: true };
}
