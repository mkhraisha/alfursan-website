-- ─────────────────────────────────────────────────────────────────────────────
-- Add 'suv' and 'hatchback' to vehicles.body_type — neither was previously a
-- recognised body type and had no accurate value to select.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_body_type_check;

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_body_type_check
  CHECK (body_type IS NULL OR body_type IN ('sedan', 'van', 'coupe', 'convertible', 'suv', 'hatchback'));
