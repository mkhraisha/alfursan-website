-- ─────────────────────────────────────────────────────────────────────────────
-- Capture tax on vehicle expenses:
--   * tax_type   — Canadian sales tax type applied (HST/GST/PST/QST variants)
--   * tax_rate   — the rate for that type, as a fraction (0.13 = 13%)
--   * tax_amount — dollar amount of tax paid on the line item
-- tax_type and tax_rate mirror src/lib/vehicles.ts TAX_TYPES — keep in sync.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE vehicle_expenses
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10, 2) CHECK (tax_amount IS NULL OR tax_amount >= 0),
  ADD COLUMN IF NOT EXISTS tax_rate   DECIMAL(6, 5)  CHECK (tax_rate IS NULL OR tax_rate >= 0),
  ADD COLUMN IF NOT EXISTS tax_type   TEXT
    CHECK (tax_type IS NULL OR tax_type IN (
      'HST_ON', 'HST_15', 'GST_ONLY', 'GST_PST_BC', 'GST_PST_SK', 'GST_PST_MB', 'GST_QST_QC', 'NONE'
    ));
