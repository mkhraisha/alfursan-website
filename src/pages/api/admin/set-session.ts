export const prerender = false;

import type { APIRoute } from "astro";

/**
 * POST /api/admin/set-session
 *
 * Accepts the Supabase JWT from the client-side callback and stores it in an
 * HttpOnly cookie so JavaScript cannot read or steal the token.
 *
 * Only callable from the same origin (enforced by the Origin check below).
 */
export const POST: APIRoute = async ({ request }) => {
  // Reject cross-origin requests — this endpoint should only be called from
  // our own callback page.
  const origin = request.headers.get("origin");
  const host   = request.headers.get("host");
  if (origin && host && !origin.includes(host)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { token?: unknown; expiresIn?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { token, expiresIn } = body;

  if (!token || typeof token !== "string" || token.length < 10) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const maxAge = typeof expiresIn === "number" && expiresIn > 0 ? expiresIn : 3600;
  const secure = import.meta.env.PROD ? "; Secure" : "";

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `sb-access-token=${encodeURIComponent(token)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
    },
  });
};
