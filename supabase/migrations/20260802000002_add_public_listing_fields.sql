-- WordPress migration Part 1: new public-listing vehicle fields.
-- These back the fields Vehica/WordPress exposed (driveType, transmission,
-- fuelType, cylinders, doors, features, htmlDescription) that InventoryFilters.tsx
-- needs parity with — see docs/WORDPRESS_MIGRATION.md Part 1.

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

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS features TEXT[] NOT NULL DEFAULT '{}';

-- Public marketing copy — distinct from internal_notes/disclosures, which stay internal-only.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS description TEXT;
