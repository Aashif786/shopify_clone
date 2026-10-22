-- Migration: 0015_create_collections_schema.sql
-- Description: Creates collections and collection_products tables with strict tenant-isolation foreign keys and indexes.

-- Ensure products has a composite unique constraint on (id, store_id) for safe composite foreign key references
ALTER TABLE products
  ADD CONSTRAINT products_id_store_id_unique UNIQUE (id, store_id);

CREATE TABLE collections (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT collections_store_slug_unique UNIQUE (store_id, slug),
  CONSTRAINT collections_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT collections_status_check CHECK (status IN ('ACTIVE', 'ARCHIVED'))
);

CREATE INDEX collections_store_id_idx ON collections (store_id);
CREATE INDEX collections_store_id_status_created_idx ON collections (store_id, status, created_at);

CREATE TABLE collection_products (
  collection_id UUID NOT NULL,
  product_id UUID NOT NULL,
  store_id UUID NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, product_id),
  CONSTRAINT collection_products_collection_store_fkey FOREIGN KEY (collection_id, store_id)
    REFERENCES collections (id, store_id) ON DELETE CASCADE,
  CONSTRAINT collection_products_product_store_fkey FOREIGN KEY (product_id, store_id)
    REFERENCES products (id, store_id) ON DELETE CASCADE
);

CREATE INDEX collection_products_store_id_idx ON collection_products (store_id);
CREATE INDEX collection_products_collection_id_idx ON collection_products (collection_id);
CREATE INDEX collection_products_product_id_idx ON collection_products (product_id);
CREATE INDEX collection_products_collection_pos_idx ON collection_products (collection_id, position ASC);

-- Add index on products lower(title) for search optimization
CREATE INDEX products_store_title_lower_idx ON products (store_id, lower(title));
