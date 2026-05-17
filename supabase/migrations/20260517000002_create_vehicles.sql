-- ─────────────────────────────────────────────────────────────────────────────
-- vehicles: core inventory table for the Dealer Management System.
-- VIN is the primary key (natural automotive identifier, always required).
-- status is TEXT[] to allow multiple simultaneous statuses per vehicle.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicles (

  -- ── Identity ────────────────────────────────────────────────────────────────
  vin   TEXT PRIMARY KEY CHECK (length(vin) = 17 AND vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),

  -- ── Vehicle Details ──────────────────────────────────────────────────────────
  make       TEXT NOT NULL,
  model      TEXT NOT NULL,
  trim       TEXT,
  series     TEXT,
  body_type  TEXT,
  year       SMALLINT NOT NULL CHECK (year BETWEEN 1900 AND 2100),
  colour     TEXT,
  odometer   INTEGER CHECK (odometer >= 0),

  -- ── Purchase Information ─────────────────────────────────────────────────────
  purchase_date  DATE CHECK (purchase_date <= CURRENT_DATE),
  purchase_price DECIMAL(12, 2) CHECK (purchase_price IS NULL OR purchase_price >= 0),

  -- ── Buyer/Seller Information (populated on sale) ──────────────────────────────
  purchaser_name    TEXT,
  purchaser_address TEXT,

  -- ── Pricing ──────────────────────────────────────────────────────────────────
  wholesale_price  DECIMAL(12, 2) CHECK (wholesale_price IS NULL OR wholesale_price >= 0),
  advertised_price DECIMAL(12, 2) CHECK (advertised_price IS NULL OR advertised_price >= 0),
  sale_price       DECIMAL(12, 2) CHECK (sale_price IS NULL OR sale_price >= 0),
  sale_date        DATE           CHECK (sale_date IS NULL OR sale_date <= CURRENT_DATE),

  -- ── Ownership & Status ────────────────────────────────────────────────────────
  ownership_status TEXT NOT NULL DEFAULT 'not_received'
    CHECK (ownership_status IN ('available', 'en_route', 'not_received')),

  -- Array of statuses — vehicle can be in multiple states simultaneously
  -- e.g. ['in_deal', 'pending_delivery']
  status TEXT[] NOT NULL DEFAULT '{}'
    CHECK (status <@ ARRAY[
      'frontline_ready', 'in_deal', 'sold', 'on_lot_work_needed',
      'pending_delivery', 'pending_pickup', 'bodyshop', 'mechanic_ssc',
      'detailing_shop', 'mechanic_repairs', 'openlane_arbitration',
      'sale_cancelled_by_arbitration', 'openlane_auction'
    ]::TEXT[]),

  -- ── Photography ──────────────────────────────────────────────────────────────
  photography_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (photography_status IN ('pending', 'done', 'na')),

  -- ── Garage Register (Ontario TODS compliance) ─────────────────────────────────
  garage_register_number TEXT,

  -- ── Fixed Documents (paths in Supabase Storage: vehicle-documents bucket) ─────
  acquisition_bill_of_sale_path         TEXT,
  safety_inspection_document_path       TEXT,
  signed_bill_of_sale_path              TEXT,
  signed_ownership_sale_picture_path    TEXT,
  signed_ownership_acquisition_picture_path TEXT,

  -- ── Commission ───────────────────────────────────────────────────────────────
  commission_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- ── Media & Content ──────────────────────────────────────────────────────────
  images_json    JSONB NOT NULL DEFAULT '[]',  -- array of storage paths
  videos_json    JSONB NOT NULL DEFAULT '[]',  -- array of storage paths
  carfax_link    TEXT,
  internal_notes TEXT,
  disclosures    TEXT,

  -- ── Metadata ─────────────────────────────────────────────────────────────────
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── Cross-field constraints ───────────────────────────────────────────────────
  CONSTRAINT sale_date_after_purchase CHECK (
    sale_date IS NULL OR purchase_date IS NULL OR sale_date >= purchase_date
  )
);

CREATE TRIGGER vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS vehicles_make_model_idx    ON vehicles (make, model);
CREATE INDEX IF NOT EXISTS vehicles_created_at_idx    ON vehicles (created_at DESC);
CREATE INDEX IF NOT EXISTS vehicles_purchase_date_idx ON vehicles (purchase_date DESC);
CREATE INDEX IF NOT EXISTS vehicles_sale_date_idx     ON vehicles (sale_date DESC);
CREATE INDEX IF NOT EXISTS vehicles_commission_user_idx ON vehicles (commission_user_id);
