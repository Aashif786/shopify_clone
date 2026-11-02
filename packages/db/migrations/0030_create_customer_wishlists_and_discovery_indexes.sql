-- Migration: 0030_create_customer_wishlists_and_discovery_indexes.sql
-- Description: Creates customer_wishlists table with strict tenant isolation and
--              indexes for product discovery, search, sorting, and filter aggregation.

-- 1. Customer Wishlists Table
CREATE TABLE IF NOT EXISTS customer_wishlists (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index ensuring no duplicate wishlist entries per customer per store
CREATE UNIQUE INDEX IF NOT EXISTS customer_wishlists_with_variant_unique_idx
  ON customer_wishlists (store_id, customer_id, product_id, variant_id)
  WHERE variant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_wishlists_no_variant_unique_idx
  ON customer_wishlists (store_id, customer_id, product_id)
  WHERE variant_id IS NULL;

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS customer_wishlists_store_customer_idx
  ON customer_wishlists (store_id, customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS customer_wishlists_store_product_idx
  ON customer_wishlists (store_id, product_id);

CREATE INDEX IF NOT EXISTS customer_wishlists_customer_id_idx
  ON customer_wishlists (customer_id);

-- 2. Discovery & Performance Indexes for Search, Sorting, and Filters
CREATE INDEX IF NOT EXISTS products_store_status_published_idx
  ON products (store_id, status, published_at DESC);

CREATE INDEX IF NOT EXISTS product_variants_store_price_idx
  ON product_variants (store_id, price);

CREATE INDEX IF NOT EXISTS product_variants_store_compare_at_price_idx
  ON product_variants (store_id, compare_at_price)
  WHERE compare_at_price IS NOT NULL;

CREATE INDEX IF NOT EXISTS order_items_product_id_idx
  ON order_items (product_id);
