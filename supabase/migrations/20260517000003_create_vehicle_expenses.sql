-- ─────────────────────────────────────────────────────────────────────────────
-- vehicle_expenses: line-item cost tracking per vehicle.
-- Cascades on vehicle delete. amount must be > 0.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicle_expenses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vin              TEXT NOT NULL REFERENCES vehicles(vin) ON DELETE CASCADE,
  category         TEXT NOT NULL
                     CHECK (category IN ('repair', 'detailing', 'parts', 'other')),
  description      TEXT NOT NULL,
  amount           DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  receipt_file_path TEXT,  -- optional path in vehicle-documents storage bucket
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vehicle_expenses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS vehicle_expenses_vin_idx ON vehicle_expenses (vin);
