import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";
import type { Role } from "./lib/permissions";

/**
 * Middleware — runs on every request.
 *
 * For /admin/** and /dealer/** routes:
 *   1. Reads the Supabase session from the Authorization header or cookie.
 *   2. Looks up the authenticated user in the user_profiles table.
 *   3. Checks is_active = true.
 *   4. Attaches adminEmail + adminRole to Astro.locals.
 *   5. Redirects to the appropriate login page if any check fails.
 *
 * Public and API routes are passed through unchanged.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  // Permissive baseline CSP — tighten once nonce-based inline scripts are in place
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

export const onRequest = defineMiddleware(async ({ locals, request, url, redirect }, next) => {
  const isAdminRoute  = url.pathname.startsWith("/admin/");
  const isDealerRoute = url.pathname.startsWith("/dealer/");
  const isProtectedRoute = isAdminRoute || isDealerRoute;

  const isPublicPage =
    url.pathname === "/admin/" ||
    url.pathname === "/admin" ||
    url.pathname === "/dealer/" ||
    url.pathname === "/dealer" ||
    url.pathname.startsWith("/admin/callback") ||
    url.pathname.startsWith("/admin/signout") ||
    url.pathname.startsWith("/dealer/callback") ||
    url.pathname.startsWith("/dealer/signout");

  if (!isProtectedRoute || isPublicPage) {
    const res = await next();
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      res.headers.set(header, value);
    }
    return res;
  }

  const supabaseUrl            = import.meta.env.SUPABASE_URL ?? "";
  const supabaseServiceRoleKey = import.meta.env.SUPABASE_SECRET_KEY ?? "";
  const supabaseAnonKey        = import.meta.env.SUPABASE_PUBLISHABLE_KEY ?? "";

  const loginPage = isDealerRoute ? "/dealer/" : "/admin/";

  if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
    console.error("[middleware] Missing Supabase env vars");
    const r = redirect(loginPage);
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) r.headers.set(header, value);
    return r;
  }

  const authHeader  = request.headers.get("authorization");
  const cookieHeader = request.headers.get("cookie");

  let accessToken: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    accessToken = authHeader.slice(7);
  } else if (cookieHeader) {
    const match = cookieHeader.match(/sb-access-token=([^;]+)/);
    if (match) accessToken = decodeURIComponent(match[1]);
  }

  if (!accessToken) {
    const r = redirect(`${loginPage}?error=no_token`);
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) r.headers.set(header, value);
    return r;
  }

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userError } = await anonClient.auth.getUser(accessToken);

  if (userError || !user?.email) {
    console.error("[middleware] getUser failed", userError);
    const r = redirect(`${loginPage}?error=invalid_token`);
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) r.headers.set(header, value);
    return r;
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await adminClient
    .from("user_profiles")
    .select("id, role, is_active")
    .eq("email", user.email)
    .single();

  if (profileError || !profile || !profile.is_active) {
    console.error("[middleware] user_profiles check failed", { profileError });
    const r = redirect(`${loginPage}?error=unauthorized`);
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) r.headers.set(header, value);
    return r;
  }

  locals.adminEmail  = user.email;
  locals.adminRole   = profile.role as Role;
  locals.dealerUserId = profile.id as string;

  const res = await next();
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(header, value);
  }
  return res;
});
