-- ─────────────────────────────────────────────────────────────────────────────
-- WordPress migration Part 1 (docs/WORDPRESS_MIGRATION.md): add the vehicle
-- spec fields the public listing page needs but that have no equivalent
-- column today — drive_type, transmission, fuel_type, cylinders, doors,
-- features, and a public-facing description. `condition` (new/used) is
-- deliberately not added: the dealership only sells used vehicles.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS drive_type TEXT
  CHECK (drive_type IS NULL OR drive_type IN ('fwd', 'rwd', 'awd', '4wd'));

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS transmission TEXT
  CHECK (transmission IS NULL OR transmission IN ('automatic', 'manual', 'cvt'));

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_type TEXT
  CHECK (fuel_type IS NULL OR fuel_type IN ('gasoline', 'diesel', 'hybrid', 'electric'));

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cylinders SMALLINT
  CHECK (cylinders IS NULL OR cylinders > 0);

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS doors SMALLINT
  CHECK (doors IS NULL OR doors BETWEEN 2 AND 6);

-- List of marketing feature tags (e.g. "Backup Camera", "Heated Seats"),
-- shown as a bullet list on the public listing page.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS features TEXT[] NOT NULL DEFAULT '{}';

-- Public marketing copy shown on the listing page — distinct from
-- internal_notes (staff-only) and disclosures (bill-of-sale legal text).
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS description TEXT;
