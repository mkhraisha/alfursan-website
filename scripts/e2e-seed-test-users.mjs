#!/usr/bin/env node
/**
 * Seeds manager/sales test users against a running local Supabase stack and
 * signs them in to obtain real JWTs for the RBAC/CRUD e2e suite
 * (e2e/vehicles-api.spec.ts). Run this after `supabase start` + `db reset`
 * and before starting the app, then export the printed values.
 *
 * Local-only: creates users via the service-role admin API against
 * SUPABASE_URL, which in CI/local dev always points at 127.0.0.1. Never run
 * this against a production SUPABASE_URL.
 */
import { createClient } from "@supabase/supabase-js";
import { appendFileSync } from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error(
    "[e2e-seed] Missing SUPABASE_URL / SUPABASE_SECRET_KEY / SUPABASE_PUBLISHABLE_KEY.\n" +
    "Run `supabase start` first and export its values (see README Testing section)."
  );
  process.exit(1);
}

let supabaseHost;
try {
  supabaseHost = new URL(SUPABASE_URL).hostname;
} catch {
  console.error(`[e2e-seed] Invalid SUPABASE_URL: ${SUPABASE_URL}`);
  process.exit(1);
}

if (!["127.0.0.1", "localhost"].includes(supabaseHost)) {
  console.error(`[e2e-seed] Refusing to run against non-local SUPABASE_URL: ${SUPABASE_URL}`);
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD = "E2E-test-password-1!";

async function findExistingUserId(email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`listUsers(): ${error.message}`);
  return data.users.find((u) => u.email === email)?.id ?? null;
}

async function seedUser(email, role) {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });

  let userId = created?.user?.id ?? null;
  if (createErr) {
    if (!/already been registered/i.test(createErr.message)) {
      throw new Error(`createUser(${email}): ${createErr.message}`);
    }
    // Re-run against a stack that wasn't freshly reset (e.g. local dev) — reuse the existing user.
    userId = await findExistingUserId(email);
    if (!userId) throw new Error(`createUser(${email}) conflicted but no existing user found`);
  }

  const { error: profileErr } = await admin
    .from("user_profiles")
    .upsert({ id: userId, email, role, is_active: true }, { onConflict: "id" });
  if (profileErr) throw new Error(`user_profiles upsert(${email}): ${profileErr.message}`);

  const { data: signedIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw new Error(`signInWithPassword(${email}): ${signInErr.message}`);
  if (!signedIn.session?.access_token) {
    throw new Error(`signInWithPassword(${email}): sign-in succeeded but no session access token was returned`);
  }

  return signedIn.session.access_token;
}

const managerToken = await seedUser("e2e-manager@example.test", "manager");
const salesToken = await seedUser("e2e-sales@example.test", "sales");

const lines = [
  `E2E_SERVICE_TOKEN=${managerToken}`,
  `E2E_MANAGER_TOKEN=${managerToken}`,
  `E2E_SALES_TOKEN=${salesToken}`,
];

if (process.env.GITHUB_ENV) {
  appendFileSync(process.env.GITHUB_ENV, lines.join("\n") + "\n");
  console.log("[e2e-seed] Wrote E2E_SERVICE_TOKEN / E2E_MANAGER_TOKEN / E2E_SALES_TOKEN to GITHUB_ENV");
} else {
  console.log(lines.join("\n"));
}
