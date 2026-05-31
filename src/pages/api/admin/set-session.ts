export const prerender = false;

import type { APIRoute } from "astro";

/**
 * POST /api/admin/set-session
 *
 * Accepts the Supabase JWT + refresh token from the client-side callback and
 * stores them in HttpOnly cookies so JavaScript cannot read or steal the tokens.
 *
 * Only callable from the same origin (enforced by the Origin check below).
 */
export const POST: APIRoute = async ({ request }) => {
  // Reject cross-origin requests — this endpoint should only be called from
  // our own callback page.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      // Invalid origin — fail closed
    }
    if (originHost !== host) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  let body: { token?: unknown; expiresIn?: unknown; refreshToken?: unknown; expiresAt?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { token, expiresIn, refreshToken, expiresAt } = body;

  if (!token || typeof token !== "string" || token.length < 10) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const maxAge = typeof expiresIn === "number" && expiresIn > 0 ? expiresIn : 28800; // 8 hours
  const secure = import.meta.env.PROD ? "; Secure" : "";

  const headers = new Headers({ "Content-Type": "application/json" });

  headers.append(
    "Set-Cookie",
    `sb-access-token=${encodeURIComponent(token)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${maxAge}`
  );

  if (refreshToken && typeof refreshToken === "string" && refreshToken.length > 0) {
    headers.append(
      "Set-Cookie",
      `sb-refresh-token=${encodeURIComponent(refreshToken)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=2592000`
    );
  }

  // sb-token-exp is intentionally NOT HttpOnly — JS reads it to schedule proactive refresh.
  if (typeof expiresAt === "number" && expiresAt > 0) {
    headers.append(
      "Set-Cookie",
      `sb-token-exp=${expiresAt}${secure}; SameSite=Lax; Path=/; Max-Age=2592000`
    );
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
