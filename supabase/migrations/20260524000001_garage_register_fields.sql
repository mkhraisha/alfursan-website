-- ─────────────────────────────────────────────────────────────────────────────
-- Add garage register fields to vehicles:
--   purchased_from_name / purchased_from_address — who the dealer acquired from
--   meter — odometer unit (km or mi), defaults to km
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS purchased_from_name    TEXT,
  ADD COLUMN IF NOT EXISTS purchased_from_address TEXT;
