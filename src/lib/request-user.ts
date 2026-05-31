import { createClient } from "@supabase/supabase-js";
import type { Role } from "./permissions";

export interface RequestUser {
  email: string;
  role: Role;
  userId: string;
}

/**
 * Extracts and verifies the Supabase session token from a Request, then
 * looks up the user in user_profiles. Returns null if unauthenticated or
 * if the profile is inactive.
 *
 * Used by API routes that serve both public and authenticated callers
 * (e.g. GET /api/vehicles, which returns different field sets per role).
 */
export async function getRequestUser(request: Request): Promise<RequestUser | null> {
  const supabaseUrl     = import.meta.env.SUPABASE_URL ?? "";
  const supabaseAnonKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY ?? "";
  const supabaseServiceKey = import.meta.env.SUPABASE_SECRET_KEY ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) return null;

  const authHeader   = request.headers.get("authorization");
  const cookieHeader = request.headers.get("cookie");

  let accessToken: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    accessToken = authHeader.slice(7);
  } else if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
    if (match) accessToken = decodeURIComponent(match[1]);
  }

  if (!accessToken) return null;

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error } = await anonClient.auth.getUser(accessToken);
  if (error || !user?.email) return null;

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await adminClient
    .from("user_profiles")
    .select("id, role, is_active")
    .eq("email", user.email)
    .single();

  if (!profile || !profile.is_active) return null;

  return { email: user.email, role: profile.role as Role, userId: profile.id as string };
}
