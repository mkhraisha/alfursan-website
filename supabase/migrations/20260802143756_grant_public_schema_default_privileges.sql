-- ─────────────────────────────────────────────────────────────────────────────
-- Grant baseline table/sequence/routine privileges to anon, authenticated,
-- and service_role on the public schema.
--
-- Supabase's hosted platform applies these grants automatically once, at
-- project creation time, outside of migration history — so every table this
-- project has ever created has relied on that platform-level default and
-- worked fine in production. The Supabase CLI's local dev stack does NOT
-- replicate that one-time setup: `supabase start` + `supabase db reset`
-- leaves anon/authenticated/service_role with only Dxtm (TRUNCATE/
-- REFERENCES/TRIGGER/MAINTAIN) on public-schema tables — no SELECT/INSERT/
-- UPDATE/DELETE. Postgres rejects those queries with 42501 "permission
-- denied" before RLS is ever evaluated, so every API route backed by a
-- public-schema table (vehicles, vehicle_expenses, business_expenses, etc.)
-- 500s when run against a fresh local stack, regardless of RLS policy
-- correctness.
--
-- This makes local dev match hosted behaviour: RLS policies (e.g. "service
-- role only" on vehicles) remain the actual authorization boundary, since
-- service_role already has BYPASSRLS. Idempotent — re-running against a
-- hosted project that already has these grants is a no-op.
-- ─────────────────────────────────────────────────────────────────────────────

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
