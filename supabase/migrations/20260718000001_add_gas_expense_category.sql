-- ─────────────────────────────────────────────────────────────────────────────
-- Add 'gas' to vehicle_expenses.category — fuel costs weren't previously
-- distinguishable from 'other'.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE vehicle_expenses DROP CONSTRAINT IF EXISTS vehicle_expenses_category_check;

ALTER TABLE vehicle_expenses
  ADD CONSTRAINT vehicle_expenses_category_check
  CHECK (category IN ('repair', 'detailing', 'parts', 'gas', 'other'));
