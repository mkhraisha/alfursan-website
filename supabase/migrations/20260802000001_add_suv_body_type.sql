-- ─────────────────────────────────────────────────────────────────────────────
-- Add 'suv', 'hatchback', and 'truck' to vehicles.body_type — none of these
-- were previously recognised body types and had no accurate value to select.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_body_type_check;

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_body_type_check
  CHECK (body_type IS NULL OR body_type IN ('sedan', 'van', 'coupe', 'convertible', 'suv', 'hatchback', 'truck'));
