import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";
import type { Role } from "./lib/permissions";

/**
 * Middleware — runs on every request.
 *
 * For /admin/** routes (excluding login, callback, signout):
 *   1. Reads the access token from Authorization header or sb-access-token cookie.
 *   2. Calls getUser(accessToken) to validate it.
 *   3. If the token is expired, transparently attempts a refresh via sb-refresh-token.
 *      On success, the rotated tokens are written to the response cookies so the
 *      browser stays logged in without any visible interruption.
 *   4. Looks up the authenticated user in user_profiles.
 *   5. Checks is_active = true.
 *   6. Attaches adminEmail + adminRole + dealerUserId to Astro.locals.
 *   7. Redirects to /admin/ if any check fails.
 *
 * Public and API routes are passed through unchanged.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
  ].join("; "),
};

function addSecurityHeaders(res: Response, isAdminRoute: boolean) {
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(header, value);
  }
  // /admin/** responses (including redirects issued by this middleware) must
  // never be cached — without this, Vercel's edge layer will heuristically
  // cache a GET response that has no Cache-Control header, so an anonymous
  // hit (e.g. the daily smoke test) can poison the cache with a login
  // redirect that then gets served to a real, freshly-authenticated user.
  if (isAdminRoute) {
    res.headers.set("Cache-Control", "no-store");
  }
}

export const onRequest = defineMiddleware(async ({ locals, request, url, redirect }, next) => {
  const isAdminRoute = url.pathname.startsWith("/admin/");

  const isPublicPage =
    url.pathname === "/admin/" ||
    url.pathname === "/admin" ||
    url.pathname.startsWith("/admin/callback") ||
    url.pathname.startsWith("/admin/signout");

  if (!isAdminRoute || isPublicPage) {
    const res = await next();
    addSecurityHeaders(res, isAdminRoute);
    return res;
  }

  const supabaseUrl            = import.meta.env.SUPABASE_URL ?? "";
  const supabaseServiceRoleKey = import.meta.env.SUPABASE_SECRET_KEY ?? "";
  const supabaseAnonKey        = import.meta.env.SUPABASE_PUBLISHABLE_KEY ?? "";

  if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
    console.error("[middleware] Missing Supabase env vars");
    const r = redirect("/admin/");
    addSecurityHeaders(r, true);
    return r;
  }

  const authHeader   = request.headers.get("authorization");
  const cookieHeader = request.headers.get("cookie") ?? "";

  let accessToken: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    accessToken = authHeader.slice(7);
  } else {
    const match = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
    if (match) accessToken = decodeURIComponent(match[1]);
  }

  if (!accessToken) {
    const r = redirect("/admin/?error=no_token");
    addSecurityHeaders(r, true);
    return r;
  }

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let { data: { user }, error: userError } = await anonClient.auth.getUser(accessToken);

  // ── Token expired — attempt transparent refresh ────────────────────────────
  type RefreshedSession = {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at?: number;
  };
  let refreshedSession: RefreshedSession | null = null;

  if (userError || !user?.email) {
    const rtMatch = cookieHeader.match(/(?:^|;\s*)sb-refresh-token=([^;]+)/);
    if (!rtMatch) {
      const r = redirect("/admin/?error=invalid_token");
      addSecurityHeaders(r, true);
      return r;
    }

    const refreshToken = decodeURIComponent(rtMatch[1]);
    const { data: rd, error: re } = await anonClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (re || !rd.session) {
      console.error("[middleware] Refresh failed", re?.message);
      const r = redirect("/admin/?error=invalid_token");
      addSecurityHeaders(r, true);
      return r;
    }

    // Re-validate with the new access token
    const revalidated = await anonClient.auth.getUser(rd.session.access_token);
    if (revalidated.error || !revalidated.data.user?.email) {
      const r = redirect("/admin/?error=invalid_token");
      addSecurityHeaders(r, true);
      return r;
    }

    user           = revalidated.data.user;
    userError      = null;
    refreshedSession = rd.session as RefreshedSession;
  }

  // ── Look up user profile ───────────────────────────────────────────────────
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await adminClient
    .from("user_profiles")
    .select("id, role, is_active")
    .eq("email", user!.email)
    .single();

  if (profileError || !profile || !profile.is_active) {
    console.error("[middleware] user_profiles check failed", { profileError });
    const r = redirect("/admin/?error=unauthorized");
    addSecurityHeaders(r, true);
    return r;
  }

  locals.adminEmail   = user!.email!;
  locals.adminRole    = profile.role as Role;
  locals.dealerUserId = profile.id as string;

  const res = await next();
  addSecurityHeaders(res, true);

  // ── Write rotated cookies if we refreshed ─────────────────────────────────
  if (refreshedSession) {
    const maxAge = typeof refreshedSession.expires_in === "number" && refreshedSession.expires_in > 0
      ? refreshedSession.expires_in : 28800;
    const secure = import.meta.env.PROD ? "; Secure" : "";

    res.headers.append(
      "Set-Cookie",
      `sb-access-token=${encodeURIComponent(refreshedSession.access_token)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${maxAge}`
    );
    res.headers.append(
      "Set-Cookie",
      `sb-refresh-token=${encodeURIComponent(refreshedSession.refresh_token)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=2592000`
    );
    if (refreshedSession.expires_at) {
      res.headers.append(
        "Set-Cookie",
        `sb-token-exp=${refreshedSession.expires_at}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=2592000`
      );
    }
  }

  return res;
});
