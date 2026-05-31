-- Add engine_type: optional free-text field for engine description
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS engine_type TEXT;

-- Add num_keys: optional integer tracking how many keys the car has
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS num_keys SMALLINT CHECK (num_keys >= 0);

-- Constrain body_type to the canonical set of values.
--
-- SAFETY: abort if any rows have unrecognised body_type values that would be
-- silently erased. Fix those rows first (set to sedan/van/coupe/convertible or
-- NULL) then re-run the migration.
DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM vehicles
  WHERE body_type IS NOT NULL
    AND LOWER(body_type) NOT IN ('sedan', 'van', 'coupe', 'convertible');

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'Migration aborted: % row(s) have unrecognised body_type values. '
      'Update or clear those rows before running this migration.',
      bad_count;
  END IF;
END $$;

-- Normalise any matching values that are already valid but not lowercase
UPDATE vehicles
  SET body_type = LOWER(body_type)
  WHERE body_type IS NOT NULL
    AND LOWER(body_type) IN ('sedan', 'van', 'coupe', 'convertible')
    AND body_type != LOWER(body_type);

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_body_type_check
  CHECK (body_type IS NULL OR body_type IN ('sedan', 'van', 'coupe', 'convertible'));
