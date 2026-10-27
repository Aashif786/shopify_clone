-- Migration: 0024_variant_standalone_publishing_and_media.sql
-- Description: Adds variant-specific display title and standalone publishing flag
--              and multi-image junction table (product_variant_media).

-- 1. Variant-Specific Title and Standalone Publishing Flag
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS display_title TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS published_as_product BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS product_variants_standalone_idx
  ON product_variants (store_id, published_as_product)
  WHERE published_as_product = TRUE;

-- 2. Multi-image junction table for product variants
CREATE TABLE IF NOT EXISTS product_variant_media (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  variant_id UUID NOT NULL REFERENCES product_variants (id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES product_media (id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_variant_media_variant_media_unique UNIQUE (variant_id, media_id)
);

CREATE INDEX IF NOT EXISTS product_variant_media_variant_pos_idx
  ON product_variant_media (variant_id, position ASC);

CREATE INDEX IF NOT EXISTS product_variant_media_media_id_idx
  ON product_variant_media (media_id);

CREATE INDEX IF NOT EXISTS product_variant_media_store_id_idx
  ON product_variant_media (store_id);

-- 3. Populate product_variant_media with any existing variant image_id references
INSERT INTO product_variant_media (id, store_id, variant_id, media_id, position, created_at)
SELECT gen_random_uuid(), pv.store_id, pv.id, pv.image_id, 0, NOW()
FROM product_variants pv
WHERE pv.image_id IS NOT NULL
ON CONFLICT (variant_id, media_id) DO NOTHING;

-- Populate with any existing product_media.variant_id references
INSERT INTO product_variant_media (id, store_id, variant_id, media_id, position, created_at)
SELECT gen_random_uuid(), pm.store_id, pm.variant_id, pm.id, pm.position, NOW()
FROM product_media pm
WHERE pm.variant_id IS NOT NULL AND pm.store_id IS NOT NULL
ON CONFLICT (variant_id, media_id) DO NOTHING;
