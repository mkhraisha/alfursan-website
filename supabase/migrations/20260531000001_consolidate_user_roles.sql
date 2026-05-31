-- Consolidate user roles to three canonical values: owner | manager | sales
--
-- Legacy mapping:
--   'admin'   → 'manager'  (DMS admin becomes manager)
--   'staff'   → 'sales'    (legacy financing staff becomes sales rep)
--   'owner'   → 'owner'    (unchanged)
--   'manager' → 'manager'  (legacy financing manager, unchanged)
--   'sales'   → 'sales'    (unchanged)

-- Step 1: migrate any legacy values
UPDATE user_profiles SET role = 'manager' WHERE role = 'admin';
UPDATE user_profiles SET role = 'sales'   WHERE role = 'staff';

-- Step 2: replace the CHECK constraint with the narrowed set
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('owner', 'manager', 'sales'));
