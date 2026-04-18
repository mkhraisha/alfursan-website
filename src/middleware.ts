import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";
import type { Role } from "./lib/permissions";

/**
 * Middleware — runs on every request.
 *
 * For /admin/** routes only:
 *   1. Reads the Supabase session from the Authorization header or cookie.
 *   2. Looks up the authenticated email in the admin_users allowlist.
 *   3. Checks is_active = true.
 *   4. Attaches adminEmail + adminRole to Astro.locals.
 *   5. Redirects to /admin/ (login) if any check fails.
 *
 * Public and API routes are passed through unchanged.
 */
export const onRequest = defineMiddleware(async ({ locals, request, url, redirect }, next) => {
  // Only gate /admin/* routes (not /admin/ itself — that's the login page)
  const isAdminRoute = url.pathname.startsWith("/admin/");
  const isLoginPage = url.pathname === "/admin/" || url.pathname === "/admin";

  if (!isAdminRoute || isLoginPage) {
    return next();
  }

  const supabaseUrl = import.meta.env.SUPABASE_URL ?? "";
  const supabaseServiceRoleKey = import.meta.env.SUPABASE_SECRET_KEY ?? "";
  const supabaseAnonKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY ?? "";

  if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
    console.error("[middleware] Missing Supabase env vars");
    return redirect("/admin/");
  }

  // Use anon client to validate the user's session token
  const authHeader = request.headers.get("authorization");
  const cookieHeader = request.headers.get("cookie");

  // Extract access token from Authorization header or sb-access-token cookie
  let accessToken: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    accessToken = authHeader.slice(7);
  } else if (cookieHeader) {
    const match = cookieHeader.match(/sb-access-token=([^;]+)/);
    if (match) accessToken = decodeURIComponent(match[1]);
  }

  if (!accessToken) {
    return redirect("/admin/");
  }

  // Verify the token and get the user's email
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userError } = await anonClient.auth.getUser(accessToken);

  if (userError || !user?.email) {
    return redirect("/admin/");
  }

  // Look up the email in the admin_users allowlist
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: adminUser, error: adminError } = await adminClient
    .from("admin_users")
    .select("role, is_active")
    .eq("email", user.email)
    .single();

  if (adminError || !adminUser || !adminUser.is_active) {
    return redirect("/admin/");
  }

  // Attach to locals for use in admin pages
  locals.adminEmail = user.email;
  locals.adminRole = adminUser.role as Role;

  return next();
});
