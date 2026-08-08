export const prerender = false;

import type { APIRoute } from "astro";
import { getRequestUser } from "../../../lib/request-user";
import { can } from "../../../lib/permissions";
import { purgeVercelCache, PUBLIC_VEHICLES_CACHE_TAG } from "../../../lib/vercel-cache";

// This route lives under /api/**, which src/middleware.ts explicitly does NOT
// run its /admin/** session-check on (see isAdminRoute there) — so
// Astro.locals.adminRole/adminEmail are never populated here. Authenticate
// directly via getRequestUser(), the same way every other /api/** route does
// (see src/pages/api/admin/export-application.ts).
export const POST: APIRoute = async ({ request }) => {
  const user = await getRequestUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  if (!can(user.role, "cache:refresh")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const result = await purgeVercelCache([PUBLIC_VEHICLES_CACHE_TAG]);

  if (!result.ok && result.reason === "disabled_in_ci") {
    // Deliberate — see purgeVercelCache()'s CI check. There's no "local"
    // Vercel to purge against, so this refuses to actually call Vercel's API
    // under CI regardless of whether real credentials happen to be set,
    // rather than let an automated e2e run invalidate the production cache.
    return new Response(
      JSON.stringify({ error: "Cache refresh is disabled in CI" }),
      { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
    );
  }

  if (!result.ok && result.reason === "not_configured") {
    // VERCEL_API_TOKEN / VERCEL_PROJECT_ID aren't set (local dev, or not yet
    // provisioned in this environment) — report clearly instead of crashing.
    return new Response(
      JSON.stringify({ error: "Cache refresh isn't configured (missing VERCEL_API_TOKEN / VERCEL_PROJECT_ID)" }),
      { status: 501, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
    );
  }

  if (!result.ok) {
    console.error("[POST /api/admin/refresh-cache]", result.status, result.body);
    return new Response(JSON.stringify({ error: "Cache refresh request failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
