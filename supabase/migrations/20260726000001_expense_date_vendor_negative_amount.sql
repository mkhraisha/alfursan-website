-- ─────────────────────────────────────────────────────────────────────────────
-- Expense CSV import follow-ups:
--   * vehicle_expenses.expense_date — the actual transaction date (distinct
--     from created_at, which tracks when the record was entered into the DMS)
--   * vehicle_expenses.vendor — who the expense was paid to
--   * allow negative amounts — refunds/credits/adjustments reduce total cost
--   * vin becomes optional — some expenses (e.g. admin/business costs) don't
--     relate to any specific vehicle
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE vehicle_expenses
  ADD COLUMN IF NOT EXISTS expense_date DATE,
  ADD COLUMN IF NOT EXISTS vendor TEXT;

ALTER TABLE vehicle_expenses ALTER COLUMN vin DROP NOT NULL;

ALTER TABLE vehicle_expenses DROP CONSTRAINT IF EXISTS vehicle_expenses_amount_check;

ALTER TABLE vehicle_expenses
  ADD CONSTRAINT vehicle_expenses_amount_check
  CHECK (amount <> 0);
