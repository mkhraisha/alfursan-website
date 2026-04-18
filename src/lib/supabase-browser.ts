import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY env vars"
  );
}

/**
 * Browser-safe Supabase client using the anon/publishable key.
 * Use only for auth/session flows (magic link, session retrieval).
 * Never use for privileged reads/writes — use supabase-admin.ts server-side.
 */
export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey);
