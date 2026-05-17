-- ─────────────────────────────────────────────────────────────────────────────
-- Extend application_audit to support DMS vehicle and user actions.
-- The original check constraint is dropped and replaced with a broader one
-- that covers both financing (existing) and DMS (new) audit events.
-- ─────────────────────────────────────────────────────────────────────────────

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
