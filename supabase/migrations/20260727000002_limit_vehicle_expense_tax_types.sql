-- Limit vehicle expense tax types to the currently supported set.
-- NOT VALID keeps historical rows (if any) from blocking this migration while
-- still enforcing the constraint for new/updated rows going forward.

ALTER TABLE vehicle_expenses
  ADD CONSTRAINT vehicle_expenses_tax_type_supported_set
  CHECK (tax_type IS NULL OR tax_type IN ('HST_ON', 'HST_15', 'GST_ONLY', 'NONE'))
  NOT VALID;
