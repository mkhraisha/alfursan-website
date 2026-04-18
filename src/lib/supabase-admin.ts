import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase admin client using the service role key.
 *
 * NEVER import this file in client-side code, React components, or any module
 * that could end up in a browser bundle. It uses SUPABASE_SECRET_KEY which
 * bypasses Row Level Security and must stay server-only.
 *
 * Safe to use in:
 *   - src/pages/api/**
 *   - src/middleware.ts
 *   - src/pages/admin/** (SSR, prerender = false)
 */
export function getAdminClient() {
  const url = import.meta.env.SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SECRET_KEY env vars"
    );
  }

  return createClient(url, key, {
    auth: {
      // Disable auto session management — this is a server-side privileged client
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
