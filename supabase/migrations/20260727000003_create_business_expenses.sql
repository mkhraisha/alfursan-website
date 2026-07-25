-- ─────────────────────────────────────────────────────────────────────────────
-- Business expenses (dealership-level, not tied to a VIN) with optional receipt
-- upload path, plus audit actions for create/update/delete events.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS business_expenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category          TEXT NOT NULL CHECK (category IN ('gas', 'transportation', 'supplies', 'marketing', 'other')),
  vendor            TEXT,
  description       TEXT NOT NULL,
  amount            DECIMAL(10, 2) NOT NULL CHECK (amount <> 0),
  expense_date      DATE NOT NULL,
  tax_amount        DECIMAL(10, 2) CHECK (tax_amount IS NULL OR tax_amount >= 0),
  tax_rate          DECIMAL(6, 5)  CHECK (tax_rate IS NULL OR tax_rate >= 0),
  tax_type          TEXT CHECK (tax_type IS NULL OR tax_type IN ('HST_ON', 'HST_15', 'GST_ONLY', 'NONE')),
  receipt_file_path TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_expenses_tax_rate_matches_type CHECK (
    tax_type IS NULL OR tax_rate IS NULL OR tax_rate = CASE tax_type
      WHEN 'HST_ON'   THEN 0.13
      WHEN 'HST_15'   THEN 0.15
      WHEN 'GST_ONLY' THEN 0.05
      WHEN 'NONE'     THEN 0
    END
  )
);

CREATE INDEX IF NOT EXISTS business_expenses_expense_date_idx ON business_expenses (expense_date DESC);

ALTER TABLE business_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role only" ON business_expenses;
CREATE POLICY "service role only" ON business_expenses
  USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS business_expenses_updated_at ON business_expenses;
CREATE TRIGGER business_expenses_updated_at
  BEFORE UPDATE ON business_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE application_audit
  DROP CONSTRAINT IF EXISTS application_audit_action_check;

ALTER TABLE application_audit
  ADD CONSTRAINT application_audit_action_check
  CHECK (action IN (
    -- Financing workflow (existing)
    'viewed_license',
    'status_changed',
    'deleted',
    'exported',
    'phase2_requested',
    'phase2_submitted',
    'application_updated',

    -- DMS: vehicle lifecycle
    'vehicle_created',
    'vehicle_updated',
    'vehicle_deleted',

    -- DMS: expenses
    'expense_added',
    'expense_deleted',
    'expense_updated',
    'business_expense_created',
    'business_expense_updated',
    'business_expense_deleted',

    -- DMS: documents
    'document_uploaded',
    'document_deleted',

    -- DMS: commission
    'commission_assigned',

    -- DMS: CSV import
    'csv_import',

    -- DMS: user management
    'user_created',
    'user_updated',
    'user_disabled',
    'user_enabled'
  ));
