-- Migration: 0052_create_gst_profiles.sql
-- Description: Creates reusable GST tax profiles / slabs per store and associates them with products.
-- Slabs can represent standard rates (e.g. 0% Exempt, 3% Gold, 5% Apparel, 12% Standard, 18% Standard, 28% Luxury)
-- with an optional default HSN code.

CREATE TABLE IF NOT EXISTS gst_profiles (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gst_rate_bps INT NOT NULL,
  hsn_code TEXT,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gst_profiles_rate_check CHECK (
    gst_rate_bps >= 0 AND gst_rate_bps <= 4000
  ),
  CONSTRAINT gst_profiles_hsn_check CHECK (
    hsn_code IS NULL OR hsn_code ~ '^[0-9]{4,8}$'
  )
);

CREATE INDEX IF NOT EXISTS gst_profiles_store_idx
  ON gst_profiles (store_id);

-- Add gst_profile_id to product_tax_profiles for linking
ALTER TABLE product_tax_profiles
  ADD COLUMN IF NOT EXISTS gst_profile_id UUID REFERENCES gst_profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS product_tax_profiles_gst_profile_idx
  ON product_tax_profiles (gst_profile_id);
