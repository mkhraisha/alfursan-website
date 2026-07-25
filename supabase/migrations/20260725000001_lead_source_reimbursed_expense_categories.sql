-- ─────────────────────────────────────────────────────────────────────────────
-- Inventory/expense CSV import support:
--   * vehicles.lead_source — where the deal/lead originated (CSV import field)
--   * vehicle_expenses.reimbursed — track whether a line item has been paid back
--   * expense categories — rename 'detailing' to 'cleaning', add 'admin'
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS lead_source TEXT;

ALTER TABLE vehicle_expenses
  ADD COLUMN IF NOT EXISTS reimbursed BOOLEAN NOT NULL DEFAULT false;

-- Rename existing 'detailing' rows before swapping the constraint
UPDATE vehicle_expenses SET category = 'cleaning' WHERE category = 'detailing';

ALTER TABLE vehicle_expenses DROP CONSTRAINT IF EXISTS vehicle_expenses_category_check;

ALTER TABLE vehicle_expenses
  ADD CONSTRAINT vehicle_expenses_category_check
  CHECK (category IN ('repair', 'cleaning', 'parts', 'gas', 'admin', 'other'));

-- Allow audit logging for reimbursed-status toggles
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
