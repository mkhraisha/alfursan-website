import { createClient } from "@supabase/supabase-js";
import type { BrowserContext } from "playwright/test";
import { TEST_USERS } from "../test-users.mjs";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4321";

/**
 * Signs in as a seeded test user (see scripts/e2e-seed-test-users.mjs) and
 * injects the same cookies /api/admin/set-session would write, so tests can
 * drive authenticated admin pages without going through magic-link.
 *
 * Requires the local Supabase stack to be running with the test users
 * already seeded (`node scripts/e2e-seed-test-users.mjs`) — throws with a
 * clear message otherwise.
 */
export async function loginAsTestUser(context: BrowserContext, role: keyof typeof TEST_USERS) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      "[admin-auth] Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY — run against a local " +
        "`supabase start` stack (see README Testing section)."
    );
  }

  const { email, password } = TEST_USERS[role];
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(
      `[admin-auth] signInWithPassword(${email}) failed: ${error?.message ?? "no session"}. ` +
        "Has scripts/e2e-seed-test-users.mjs been run against this stack?"
    );
  }

  const { access_token, refresh_token, expires_in, expires_at } = data.session;
  const url = new URL(BASE_URL);
  const secure = url.protocol === "https:";
  const expiresUnix = expires_at ?? Math.floor(Date.now() / 1000) + expires_in;

  await context.addCookies([
    {
      name: "sb-access-token",
      value: access_token,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "Lax",
    },
    {
      name: "sb-refresh-token",
      value: refresh_token,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "Lax",
    },
    {
      name: "sb-token-exp",
      value: String(expiresUnix),
      domain: url.hostname,
      path: "/",
      httpOnly: false,
      secure,
      sameSite: "Lax",
    },
  ]);
}
