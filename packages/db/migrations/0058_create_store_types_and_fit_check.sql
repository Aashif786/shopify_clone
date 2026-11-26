-- Migration: 0058_create_store_types_and_fit_check.sql
-- Description: Platform-managed store types and the merchant-controlled Fit Check flag.
-- Backward compatible: existing stores are classified as general_retail (never fashion)
-- and Fit Check defaults to disabled.

CREATE TABLE store_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_fashion BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT store_types_key_unique UNIQUE (key),
  CONSTRAINT store_types_key_format_check CHECK (key ~ '^[a-z0-9]+(_[a-z0-9]+)*$' AND LENGTH(key) <= 64),
  CONSTRAINT store_types_name_check CHECK (LENGTH(TRIM(name)) BETWEEN 1 AND 120)
);

INSERT INTO store_types (key, name, description, is_fashion) VALUES
  ('clothing_fashion', 'Clothing / Fashion', 'Apparel, footwear and fashion accessories.', TRUE),
  ('electronics', 'Electronics', 'Consumer electronics and gadgets.', FALSE),
  ('home_furniture', 'Home & Furniture', 'Furniture, decor and home goods.', FALSE),
  ('beauty_personal_care', 'Beauty & Personal Care', 'Cosmetics, skincare and personal care.', FALSE),
  ('sports_fitness', 'Sports & Fitness', 'Sporting goods and fitness equipment.', FALSE),
  ('grocery', 'Grocery', 'Food and grocery items.', FALSE),
  ('general_retail', 'General Retail', 'Default classification for stores that sell a mix of goods.', FALSE);

ALTER TABLE stores
  ADD COLUMN store_type_id UUID REFERENCES store_types (id) ON DELETE RESTRICT,
  ADD COLUMN fit_check_enabled BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE stores
SET store_type_id = (SELECT id FROM store_types WHERE key = 'general_retail')
WHERE store_type_id IS NULL;

CREATE INDEX stores_store_type_id_idx ON stores (store_type_id);

-- New stores created by code paths that do not know about store types are
-- safely classified as general_retail.
CREATE FUNCTION stores_apply_store_type_defaults() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.store_type_id IS NULL THEN
    SELECT id INTO NEW.store_type_id FROM store_types WHERE key = 'general_retail';
  END IF;

  -- Defense in depth: Fit Check may only be enabled for fashion store types.
  IF NEW.fit_check_enabled AND NOT EXISTS (
    SELECT 1 FROM store_types WHERE id = NEW.store_type_id AND is_fashion
  ) THEN
    RAISE EXCEPTION 'Fit Check requires a clothing/fashion store type'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stores_store_type_defaults_trg
  BEFORE INSERT OR UPDATE OF store_type_id, fit_check_enabled ON stores
  FOR EACH ROW EXECUTE FUNCTION stores_apply_store_type_defaults();
