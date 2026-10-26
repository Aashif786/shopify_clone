-- Migration: 0021_product_options_and_variant_enhancements.sql
-- Description: Adds product options (Size, Color, Material, etc.), option values,
--              and variant combination columns (option1, option2, option3, image_id).

-- 1. Product Options Table (store-scoped)
CREATE TABLE IF NOT EXISTS product_options (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  values TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_options_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT product_options_product_name_unique UNIQUE (product_id, name)
);

CREATE INDEX IF NOT EXISTS product_options_product_id_idx ON product_options (product_id, position);
CREATE INDEX IF NOT EXISTS product_options_store_id_idx ON product_options (store_id);

-- 2. Add Combination & Image columns to product_variants
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS option1 TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS option2 TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS option3 TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS image_id UUID REFERENCES product_media (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS product_variants_options_idx
  ON product_variants (product_id, option1, option2, option3);

CREATE INDEX IF NOT EXISTS product_variants_image_id_idx
  ON product_variants (image_id);
