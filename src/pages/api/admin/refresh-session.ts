export const prerender = false;

import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/admin/refresh-session
 *
 * Reads the HttpOnly sb-refresh-token cookie, exchanges it for a new session
 * via Supabase, and rotates all three session cookies:
 *   sb-access-token  (HttpOnly)
 *   sb-refresh-token (HttpOnly)
 *   sb-token-exp     (readable by JS — Unix timestamp, used for proactive refresh)
 *
 * Called by the proactive refresh script in AdminLayout when the access token
 * is within 5 minutes of expiry.
 */

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  // Same-origin only
  const origin = request.headers.get("origin");
  const host   = request.headers.get("host");
  if (origin && host) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      // Invalid origin — fail closed
    }
    if (originHost !== host) {
      return json({ error: "Forbidden" }, 403);
    }
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)sb-refresh-token=([^;]+)/);
  if (!match) return json({ error: "No refresh token" }, 401);

  const refreshToken = decodeURIComponent(match[1]);

  const supabaseUrl     = import.meta.env.SUPABASE_URL ?? "";
  const supabaseAnonKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: "Server misconfiguration" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session) {
    console.error("[refresh-session] Refresh failed", error?.message);
    return json({ error: "Refresh failed" }, 401);
  }

  const { access_token, refresh_token: newRefreshToken, expires_in, expires_at } = data.session;
  const maxAge = typeof expires_in === "number" && expires_in > 0 ? expires_in : 28800;
  const secure = import.meta.env.PROD ? "; Secure" : "";

  const headers = new Headers({ "Content-Type": "application/json" });

  headers.append(
    "Set-Cookie",
    `sb-access-token=${encodeURIComponent(access_token)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${maxAge}`
  );
  headers.append(
    "Set-Cookie",
    `sb-refresh-token=${encodeURIComponent(newRefreshToken)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=2592000`
  );
  if (expires_at) {
    headers.append(
      "Set-Cookie",
      `sb-token-exp=${expires_at}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=2592000`
    );
  }

  return new Response(JSON.stringify({ ok: true, expiresAt: expires_at ?? null }), {
    status: 200,
    headers,
  });
};
