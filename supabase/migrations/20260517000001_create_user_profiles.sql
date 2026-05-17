-- ─────────────────────────────────────────────────────────────────────────────
-- user_profiles: unified user table for the Dealer Management System.
-- Replaces admin_users. Roles extended to include 'admin' and 'sales' (DMS)
-- alongside existing 'owner', 'manager', 'staff' (financing workflow).
-- Data is migrated from admin_users before it is dropped.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Shared trigger function for updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ── user_profiles ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT UNIQUE NOT NULL,
  -- 'owner' | 'manager' | 'staff' — inherited from financing workflow
  -- 'admin' | 'sales'             — new DMS roles
  role                  TEXT NOT NULL DEFAULT 'sales'
                          CHECK (role IN ('owner', 'manager', 'staff', 'admin', 'sales')),
  commission_percentage DECIMAL(5, 4)
                          CHECK (commission_percentage IS NULL OR commission_percentage > 0),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  disabled_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON user_profiles
  USING (auth.role() = 'service_role');


-- ── Migrate existing admin_users → user_profiles ──────────────────────────────
INSERT INTO user_profiles (id, email, role, is_active, created_at, updated_at)
SELECT id, email, role, is_active, created_at, created_at
FROM admin_users
ON CONFLICT (id) DO NOTHING;


-- ── Drop admin_users (replaced by user_profiles) ──────────────────────────────
DROP TABLE IF EXISTS admin_users;
