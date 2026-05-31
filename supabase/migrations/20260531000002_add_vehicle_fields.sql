-- Add engine_type: optional free-text field for engine description
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS engine_type TEXT;

-- Add num_keys: optional integer tracking how many keys the car has
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS num_keys SMALLINT CHECK (num_keys >= 0);

-- Constrain body_type to the canonical set of values.
-- Existing rows with non-matching values are nulled out before the constraint is added.
UPDATE vehicles
  SET body_type = LOWER(body_type)
  WHERE body_type IS NOT NULL;

UPDATE vehicles
  SET body_type = NULL
  WHERE body_type IS NOT NULL
    AND body_type NOT IN ('sedan', 'van', 'coupe', 'convertible');

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_body_type_check
  CHECK (body_type IS NULL OR body_type IN ('sedan', 'van', 'coupe', 'convertible'));
