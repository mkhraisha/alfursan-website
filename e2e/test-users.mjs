/**
 * Shared test-user credentials for local/CI e2e runs.
 *
 * Used by scripts/e2e-seed-test-users.mjs (creates these users against a
 * local Supabase stack) and e2e/helpers/admin-auth.ts (signs in as one of
 * them to drive authenticated admin UI tests). Keep both in sync with this
 * file rather than duplicating the values.
 *
 * Local-only credentials — these users only ever exist in an ephemeral
 * `supabase start` stack, never in production.
 */
export const TEST_PASSWORD = "E2E-test-password-1!";

export const TEST_USERS = {
  manager: { email: "e2e-manager@example.test", role: "manager", password: TEST_PASSWORD },
  sales: { email: "e2e-sales@example.test", role: "sales", password: TEST_PASSWORD },
};
