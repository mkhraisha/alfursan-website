-- ─────────────────────────────────────────────────────────────────────────────
-- vehicle_documents: flexible document storage for miscellaneous files
-- (warranties, service records, etc.). Fixed documents (bill of sale, inspection)
-- live as columns directly on vehicles. Cascades on vehicle delete.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicle_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vin           TEXT NOT NULL REFERENCES vehicles(vin) ON DELETE CASCADE,
  document_type TEXT NOT NULL,  -- e.g. 'warranty', 'service_record', 'other'
  file_path     TEXT NOT NULL,  -- path in vehicle-documents storage bucket
  description   TEXT,
  uploaded_by   UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS vehicle_documents_vin_idx ON vehicle_documents (vin);
