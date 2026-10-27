-- Migration: 0025_option_level_standalone_publishing.sql
-- Description: Adds option-level standalone publishing flag and option-value
--              display titles, publication status, and multi-image associations.

-- 1. Add is_publishable column to product_options
ALTER TABLE product_options
  ADD COLUMN IF NOT EXISTS is_publishable BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS product_options_publishable_idx
  ON product_options (store_id, is_publishable)
  WHERE is_publishable = TRUE;

-- 2. Option Values table (holds display title, publication status, position)
CREATE TABLE IF NOT EXISTS product_option_values (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES product_options (id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  display_title TEXT DEFAULT NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_option_values_option_val_unique UNIQUE (option_id, value)
);

CREATE INDEX IF NOT EXISTS product_option_values_product_idx
  ON product_option_values (product_id);

CREATE INDEX IF NOT EXISTS product_option_values_store_idx
  ON product_option_values (store_id);

CREATE INDEX IF NOT EXISTS product_option_values_option_idx
  ON product_option_values (option_id, position ASC);

CREATE INDEX IF NOT EXISTS product_option_values_published_idx
  ON product_option_values (store_id, is_published)
  WHERE is_published = TRUE;

-- 3. Option Value Media junction table (multi-image assignment scoped to option value)
CREATE TABLE IF NOT EXISTS product_option_value_media (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  option_value_id UUID NOT NULL REFERENCES product_option_values (id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES product_media (id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_option_value_media_val_media_unique UNIQUE (option_value_id, media_id)
);

CREATE INDEX IF NOT EXISTS product_option_value_media_val_pos_idx
  ON product_option_value_media (option_value_id, position ASC);

CREATE INDEX IF NOT EXISTS product_option_value_media_media_id_idx
  ON product_option_value_media (media_id);

CREATE INDEX IF NOT EXISTS product_option_value_media_store_idx
  ON product_option_value_media (store_id);

-- 4. Safe migration for existing data
-- A. Mark options publishable if existing variants had published_as_product = true
UPDATE product_options po
SET is_publishable = TRUE
WHERE EXISTS (
  SELECT 1 FROM product_variants pv
  WHERE pv.product_id = po.product_id
    AND pv.published_as_product = TRUE
    AND (
      (po.position = 0 AND pv.option1 IS NOT NULL) OR
      (po.position = 1 AND pv.option2 IS NOT NULL) OR
      (po.position = 2 AND pv.option3 IS NOT NULL)
    )
);

-- B. Populate product_option_values for all existing options
INSERT INTO product_option_values (id, store_id, product_id, option_id, value, display_title, is_published, position, created_at, updated_at)
SELECT
  gen_random_uuid(),
  po.store_id,
  po.product_id,
  po.id,
  val,
  NULL,
  TRUE,
  (ord - 1)::int,
  NOW(),
  NOW()
FROM product_options po,
     UNNEST(po.values) WITH ORDINALITY AS t(val, ord)
ON CONFLICT (option_id, value) DO NOTHING;

-- C. Migrate display_title from previously published variants
UPDATE product_option_values pov
SET display_title = pv.display_title
FROM product_variants pv
JOIN product_options po ON po.product_id = pv.product_id
WHERE pov.option_id = po.id
  AND (
    (po.position = 0 AND pv.option1 = pov.value) OR
    (po.position = 1 AND pv.option2 = pov.value) OR
    (po.position = 2 AND pv.option3 = pov.value)
  )
  AND pv.display_title IS NOT NULL
  AND pov.display_title IS NULL;

-- D. Migrate media from product_variant_media into product_option_value_media
INSERT INTO product_option_value_media (id, store_id, product_id, option_value_id, media_id, position, created_at)
SELECT DISTINCT ON (pov.id, pvm.media_id)
  gen_random_uuid(),
  pov.store_id,
  pov.product_id,
  pov.id,
  pvm.media_id,
  pvm.position,
  NOW()
FROM product_variant_media pvm
JOIN product_variants pv ON pv.id = pvm.variant_id
JOIN product_options po ON po.product_id = pv.product_id
JOIN product_option_values pov ON pov.option_id = po.id AND (
  (po.position = 0 AND pv.option1 = pov.value) OR
  (po.position = 1 AND pv.option2 = pov.value) OR
  (po.position = 2 AND pv.option3 = pov.value)
)
ON CONFLICT (option_value_id, media_id) DO NOTHING;
