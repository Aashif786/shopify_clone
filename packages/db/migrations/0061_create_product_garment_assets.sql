-- Migration: 0061_create_product_garment_assets.sql
-- Description: Merchant-uploaded 3D garment assets (GLB) for Fit Check, attached at product
-- level (variant_id NULL) or variant level. Binary files live in object/file storage; this
-- table holds metadata and the reference body the garment was authored for.

CREATE TABLE product_garment_assets (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants (id) ON DELETE CASCADE,
  slot TEXT NOT NULL,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_size INT NOT NULL,
  sha256 TEXT NOT NULL,
  reference_height_cm NUMERIC(5, 1) NOT NULL,
  reference_chest_cm NUMERIC(5, 1) NOT NULL,
  reference_waist_cm NUMERIC(5, 1) NOT NULL,
  reference_hip_cm NUMERIC(5, 1) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_garment_assets_slot_check CHECK (slot IN ('top', 'bottom', 'outerwear', 'dress')),
  CONSTRAINT product_garment_assets_size_check CHECK (file_size > 0),
  CONSTRAINT product_garment_assets_reference_check CHECK (
    reference_height_cm BETWEEN 100 AND 250 AND
    reference_chest_cm BETWEEN 50 AND 200 AND
    reference_waist_cm BETWEEN 40 AND 200 AND
    reference_hip_cm BETWEEN 50 AND 220
  )
);

CREATE UNIQUE INDEX product_garment_assets_product_level_idx
  ON product_garment_assets (product_id) WHERE variant_id IS NULL;
CREATE UNIQUE INDEX product_garment_assets_variant_level_idx
  ON product_garment_assets (product_id, variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX product_garment_assets_store_id_idx ON product_garment_assets (store_id);
