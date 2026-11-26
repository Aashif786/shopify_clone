-- Migration: 0062_garment_assets_generated_source.sql
-- Description: Photo-driven garments. A garment can now be generated at runtime from a template
-- (cut) plus a fit, conforming to each customer's avatar, and textured from a product photo,
-- instead of being an uploaded GLB. Existing rows are GLB assets and keep working unchanged.

ALTER TABLE product_garment_assets
  ADD COLUMN source TEXT NOT NULL DEFAULT 'glb',
  ADD COLUMN template TEXT,
  ADD COLUMN fit TEXT,
  ADD COLUMN texture_media_id UUID REFERENCES product_media (id) ON DELETE SET NULL;

ALTER TABLE product_garment_assets
  ALTER COLUMN file_name DROP NOT NULL,
  ALTER COLUMN original_name DROP NOT NULL,
  ALTER COLUMN file_size DROP NOT NULL,
  ALTER COLUMN sha256 DROP NOT NULL,
  ALTER COLUMN reference_height_cm DROP NOT NULL,
  ALTER COLUMN reference_chest_cm DROP NOT NULL,
  ALTER COLUMN reference_waist_cm DROP NOT NULL,
  ALTER COLUMN reference_hip_cm DROP NOT NULL;

ALTER TABLE product_garment_assets
  DROP CONSTRAINT product_garment_assets_size_check,
  DROP CONSTRAINT product_garment_assets_reference_check;

ALTER TABLE product_garment_assets
  ADD CONSTRAINT product_garment_assets_source_check CHECK (source IN ('glb', 'generated')),
  ADD CONSTRAINT product_garment_assets_template_check CHECK (
    template IS NULL OR template IN ('tshirt', 'longsleeve', 'jacket', 'trousers', 'shorts')
  ),
  ADD CONSTRAINT product_garment_assets_fit_check CHECK (fit IS NULL OR fit IN ('slim', 'regular', 'loose')),
  ADD CONSTRAINT product_garment_assets_shape_check CHECK (
    (
      source = 'glb'
      AND template IS NULL AND fit IS NULL
      AND file_name IS NOT NULL AND original_name IS NOT NULL
      AND file_size IS NOT NULL AND file_size > 0 AND sha256 IS NOT NULL
      AND reference_height_cm IS NOT NULL AND reference_height_cm BETWEEN 100 AND 250
      AND reference_chest_cm IS NOT NULL AND reference_chest_cm BETWEEN 50 AND 200
      AND reference_waist_cm IS NOT NULL AND reference_waist_cm BETWEEN 40 AND 200
      AND reference_hip_cm IS NOT NULL AND reference_hip_cm BETWEEN 50 AND 220
    ) OR (
      source = 'generated'
      AND template IS NOT NULL AND fit IS NOT NULL
      AND file_name IS NULL
    )
  );
