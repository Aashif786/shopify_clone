-- Migration 0048: Add cod_enabled column to products table
-- Default to TRUE for backward compatibility with existing products, stores, and checkout tests.

ALTER TABLE products
ADD COLUMN IF NOT EXISTS cod_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS products_store_cod_enabled_idx
ON products (store_id, cod_enabled);
