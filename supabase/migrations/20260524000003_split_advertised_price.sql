-- ─────────────────────────────────────────────────────────────────────────────
-- Split advertised_price into two platform-specific columns:
--   advertised_price_cargurus  — listing price on CarGurus
--   advertised_price_facebook  — listing price on Facebook Marketplace
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE vehicles
  RENAME COLUMN advertised_price TO advertised_price_cargurus;

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS advertised_price_facebook DECIMAL(12, 2)
    CHECK (advertised_price_facebook IS NULL OR advertised_price_facebook >= 0);
