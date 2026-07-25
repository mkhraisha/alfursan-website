-- ─────────────────────────────────────────────────────────────────────────────
-- Prevent tax_rate from drifting away from the canonical rate for tax_type
-- (e.g. tax_type = 'HST_ON' with an incorrect tax_rate = 0.05). Enforced at
-- the DB layer as a backstop to the application-level check in
-- src/lib/vehicles.ts expenseCreateSchema — mirrors TAX_TYPES; keep in sync.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE vehicle_expenses
  ADD CONSTRAINT vehicle_expenses_tax_rate_matches_type CHECK (
    tax_type IS NULL OR tax_rate IS NULL OR tax_rate = CASE tax_type
      WHEN 'HST_ON'     THEN 0.13
      WHEN 'HST_15'     THEN 0.15
      WHEN 'GST_ONLY'   THEN 0.05
      WHEN 'GST_PST_BC' THEN 0.12
      WHEN 'GST_PST_SK' THEN 0.11
      WHEN 'GST_PST_MB' THEN 0.12
      WHEN 'GST_QST_QC' THEN 0.14975
      WHEN 'NONE'       THEN 0
    END
  );
