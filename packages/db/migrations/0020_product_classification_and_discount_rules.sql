-- Migration: 0020_product_classification_and_discount_rules.sql
-- Description: Adds product types, hierarchical categories, product tags,
--              tenant-scoped media enhancements, and advanced discount eligibility rules.

-- 1. Product Types (store-scoped)
CREATE TABLE IF NOT EXISTS product_types (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_types_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT product_types_store_slug_unique UNIQUE (store_id, slug),
  CONSTRAINT product_types_store_name_unique UNIQUE (store_id, name)
);

CREATE INDEX IF NOT EXISTS product_types_store_id_idx ON product_types (store_id);

-- 2. Categories (store-scoped, hierarchical)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  parent_id UUID,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT categories_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT categories_store_slug_unique UNIQUE (store_id, slug),
  CONSTRAINT categories_parent_store_fkey FOREIGN KEY (parent_id, store_id)
    REFERENCES categories (id, store_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS categories_store_id_idx ON categories (store_id);
CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON categories (parent_id);

-- 3. Product Tags (store-scoped, normalized)
CREATE TABLE IF NOT EXISTS product_tags (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_tags_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT product_tags_store_normalized_name_unique UNIQUE (store_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS product_tags_store_id_idx ON product_tags (store_id);

-- 4. Product Tag Assignments (many-to-many, tenant-isolated)
CREATE TABLE IF NOT EXISTS product_tag_assignments (
  product_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  store_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, tag_id),
  CONSTRAINT product_tag_assignments_product_store_fkey FOREIGN KEY (product_id, store_id)
    REFERENCES products (id, store_id) ON DELETE CASCADE,
  CONSTRAINT product_tag_assignments_tag_store_fkey FOREIGN KEY (tag_id, store_id)
    REFERENCES product_tags (id, store_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS product_tag_assignments_store_id_idx ON product_tag_assignments (store_id);
CREATE INDEX IF NOT EXISTS product_tag_assignments_product_id_idx ON product_tag_assignments (product_id);
CREATE INDEX IF NOT EXISTS product_tag_assignments_tag_id_idx ON product_tag_assignments (tag_id);

-- 5. Extend Products table with type_id and category_id
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS type_id UUID,
  ADD COLUMN IF NOT EXISTS category_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_type_store_fkey'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_type_store_fkey FOREIGN KEY (type_id, store_id)
      REFERENCES product_types (id, store_id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_category_store_fkey'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_category_store_fkey FOREIGN KEY (category_id, store_id)
      REFERENCES categories (id, store_id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS products_store_type_id_idx ON products (store_id, type_id);
CREATE INDEX IF NOT EXISTS products_store_category_id_idx ON products (store_id, category_id);

-- 6. Extend Product Media with store_id for strict tenant isolation
ALTER TABLE product_media
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores (id) ON DELETE RESTRICT;

UPDATE product_media
SET store_id = products.store_id
FROM products
WHERE product_media.product_id = products.id
  AND product_media.store_id IS NULL;

CREATE INDEX IF NOT EXISTS product_media_store_id_idx ON product_media (store_id);

-- 7. Advanced Discount Eligibility Rules
ALTER TABLE discounts
  ADD COLUMN IF NOT EXISTS applies_to_first_time_customer BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS eligible_product_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS eligible_collection_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS eligible_category_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS eligible_product_type_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS eligible_tag_ids UUID[] NOT NULL DEFAULT '{}';
