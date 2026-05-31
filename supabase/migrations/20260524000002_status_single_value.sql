-- ─────────────────────────────────────────────────────────────────────────────
-- Change vehicles.status from TEXT[] to a single TEXT value.
-- A vehicle can only be in one status at a time.
-- Existing rows: take the first element of the array, or NULL if empty.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE vehicles ADD COLUMN status_new TEXT;

UPDATE vehicles
SET status_new = CASE
  WHEN array_length(status, 1) > 0 THEN status[1]
  ELSE NULL
END;

ALTER TABLE vehicles DROP COLUMN status;

ALTER TABLE vehicles RENAME COLUMN status_new TO status;

ALTER TABLE vehicles ADD CONSTRAINT vehicles_status_check CHECK (
  status IS NULL OR status IN (
    'frontline_ready', 'in_deal', 'sold', 'on_lot_work_needed',
    'pending_delivery', 'pending_pickup', 'bodyshop', 'mechanic_ssc',
    'detailing_shop', 'mechanic_repairs', 'openlane_arbitration',
    'sale_cancelled_by_arbitration', 'openlane_auction'
  )
);
