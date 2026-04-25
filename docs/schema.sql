-- ─────────────────────────────────────────────────────────────────────────────
-- Alfursan Auto — Supabase Schema
-- Run this in the Supabase SQL editor to provision all tables for Phase 1.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── admin_users ───────────────────────────────────────────────────────────────
-- Authorization allowlist. Supabase Auth handles identity (magic link);
-- this table handles authorization. Any authenticated email NOT in this table
-- is rejected by middleware, even with a valid Supabase session.

CREATE TABLE IF NOT EXISTS admin_users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT UNIQUE NOT NULL,
  role       TEXT NOT NULL DEFAULT 'staff'
               CHECK (role IN ('owner', 'manager', 'staff')),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Service role only — all reads/writes go through the server-side admin client.
CREATE POLICY "service role only" ON admin_users
  USING (auth.role() = 'service_role');

-- Seed: pull UUID from your existing auth.users row by email.
-- INSERT INTO admin_users (id, email, role)
-- SELECT id, email, 'owner' FROM auth.users WHERE email = 'owner@example.com';


-- ── applications ─────────────────────────────────────────────────────────────
-- One row per financing application.
-- Note: SIN is not collected (ADR-002). This may be added in a future phase.

CREATE TABLE IF NOT EXISTS applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'reviewing', 'approved', 'declined',
                                      'document_incomplete', 'documents_submitted')),

  -- Personal
  full_name       TEXT NOT NULL,
  dob             DATE NOT NULL,
  address         TEXT,
  postal_code     TEXT,
  time_at_address TEXT,
  prev_addresses  JSONB,          -- [{address, postalCode, sinceYear, sinceMonth}, ...]
  phone           TEXT,
  email           TEXT NOT NULL,
  marital_status  TEXT,

  -- Employment
  employment_status    TEXT,
  employer             TEXT,
  employer_address     TEXT,
  employer_phone       TEXT,
  job_title            TEXT,
  annual_income        NUMERIC,
  time_at_employer     TEXT,
  prev_employers       JSONB,     -- [{employer, sinceYear, sinceMonth}, ...]

  -- Vehicle & Loan
  vehicle_year      TEXT,
  vehicle_make      TEXT,
  vehicle_model     TEXT,
  vehicle_price     NUMERIC,
  down_payment      NUMERIC,
  loan_term_months  INT,
  vin               TEXT,
  listing_slug      TEXT,         -- link back to listing page if prefilled

  -- Driver's License (paths in private Supabase Storage bucket)
  license_front_path   TEXT,      -- NULL if not uploaded
  license_back_path    TEXT,      -- NULL if not uploaded
  license_uploaded_at  TIMESTAMPTZ,
  license_consent      BOOLEAN NOT NULL DEFAULT false,

  -- Compliance
  consent_timestamp TIMESTAMPTZ NOT NULL,
  ip_hash           TEXT,          -- SHA-256 of submitter IP; raw IP never stored

  -- Phase 2 — Documents & References
  phase2_token          TEXT UNIQUE,   -- UUID token emailed to applicant
  void_cheque_path      TEXT,
  proof_insurance_path  TEXT,
  payslip_path          TEXT,
  dealertrack_consent   BOOLEAN NOT NULL DEFAULT false,
  references            JSONB,         -- [{name, phone, relationship}, ...]
  phase2_submitted_at   TIMESTAMPTZ
);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
-- No public access. All reads/writes go through the server-only admin client.


-- ── application_audit ────────────────────────────────────────────────────────
-- Append-only audit log required for PIPEDA compliance.
-- Records every admin action on sensitive application data.
-- Rows survive application deletion (ON DELETE SET NULL on application_id).

CREATE TABLE IF NOT EXISTS application_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID REFERENCES applications(id) ON DELETE SET NULL,
  application_ref TEXT NOT NULL,  -- stable UUID captured at write time; survives DELETE
  action          TEXT NOT NULL
                    CHECK (action IN (
                      'viewed_license',
                      'status_changed',
                      'deleted',
                      'exported',
                      'phase2_requested',
                      'phase2_submitted',
                      'application_updated'
                    )),
  admin_email     TEXT NOT NULL,
  ip_hash         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE application_audit ENABLE ROW LEVEL SECURITY;
-- No public access. Written only by server-side admin routes.


-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS applications_status_idx    ON applications (status);
CREATE INDEX IF NOT EXISTS applications_created_at_idx ON applications (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_application_ref_idx  ON application_audit (application_ref);


-- ── Retention (pg_cron) ───────────────────────────────────────────────────────
-- Run after enabling the pg_cron extension (Database → Extensions → pg_cron).

-- 1. Purge orphaned tmp/ licence uploads older than 24 hours.
--    (Files from completed applications live under applications/{id}/, not tmp/.)
-- SELECT cron.schedule(
--   'cleanup-tmp-uploads',
--   '0 * * * *',
--   $$
--   SELECT extensions.delete_objects(
--     'license-documents',
--     (SELECT array_agg(name) FROM storage.objects
--      WHERE bucket_id = 'license-documents'
--        AND name LIKE 'tmp/%'
--        AND created_at < now() - interval '24 hours')
--   );
--   $$
-- );

-- 2. PIPEDA 7-year retention: hard-delete applications (+ their storage files)
--    older than 7 years. Runs daily at 02:00 UTC.
--    Note: storage files must be cleaned up separately (see admin delete action
--    in src/pages/admin/applications/[id].astro for the pattern).
-- SELECT cron.schedule(
--   'purge-old-applications',
--   '0 2 * * *',
--   $$
--   DELETE FROM applications
--   WHERE created_at < now() - interval '7 years';
--   $$
-- );

-- INSERT INTO admin_users (id, email, role)
-- SELECT id, email, 'owner'
-- FROM auth.users
-- WHERE email = 'your-email@alfursanauto.ca';


-- ── Phase 2 migration (run on existing databases) ─────────────────────────────
-- Safe to run multiple times (all use IF NOT EXISTS / DO $$ patterns).

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS phase2_token         TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS void_cheque_path     TEXT,
  ADD COLUMN IF NOT EXISTS proof_insurance_path TEXT,
  ADD COLUMN IF NOT EXISTS payslip_path         TEXT,
  ADD COLUMN IF NOT EXISTS dealertrack_consent  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "references"         JSONB,
  ADD COLUMN IF NOT EXISTS phase2_submitted_at  TIMESTAMPTZ;

-- Widen the status CHECK constraint to include Phase 2 statuses.
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications
  ADD CONSTRAINT applications_status_check
  CHECK (status IN ('new', 'reviewing', 'approved', 'declined',
                    'document_incomplete', 'documents_submitted'));

-- Widen the audit action CHECK constraint.
ALTER TABLE application_audit DROP CONSTRAINT IF EXISTS application_audit_action_check;
ALTER TABLE application_audit
  ADD CONSTRAINT application_audit_action_check
  CHECK (action IN (
    'viewed_license',
    'status_changed',
    'deleted',
    'exported',
    'phase2_requested',
    'phase2_submitted',
    'application_updated'
  ));