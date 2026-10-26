-- Migration: 0022_create_product_reviews_schema.sql
-- Description: Creates product_reviews, product_review_moderation_logs, and product_review_reports tables

-- 1. Product Reviews Table
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers (id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders (id) ON DELETE SET NULL,
  variant_id UUID REFERENCES product_variants (id) ON DELETE SET NULL,
  rating INT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  customer_name_snapshot TEXT NOT NULL,
  customer_email_snapshot TEXT,
  merchant_reply TEXT,
  merchant_reply_at TIMESTAMPTZ,
  merchant_reply_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  moderated_at TIMESTAMPTZ,
  moderated_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  moderation_reason TEXT,
  report_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_reviews_rating_check CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT product_reviews_status_check CHECK (status IN ('PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN')),
  CONSTRAINT product_reviews_title_length_check CHECK (char_length(title) >= 1 AND char_length(title) <= 150),
  CONSTRAINT product_reviews_content_length_check CHECK (char_length(content) >= 1 AND char_length(content) <= 3000),
  CONSTRAINT product_reviews_report_count_check CHECK (report_count >= 0)
);

-- Unique constraint for verified order purchase: 1 review per customer per product per order
CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_verified_order_unique_idx 
  ON product_reviews (store_id, customer_id, product_id, order_id) 
  WHERE customer_id IS NOT NULL AND order_id IS NOT NULL;

-- Unique constraint for unverified reviews: 1 unverified review per customer per product
CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_unverified_unique_idx 
  ON product_reviews (store_id, customer_id, product_id) 
  WHERE customer_id IS NOT NULL AND order_id IS NULL;

-- Query optimization indexes
CREATE INDEX IF NOT EXISTS product_reviews_store_product_status_idx ON product_reviews (store_id, product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS product_reviews_store_status_created_idx ON product_reviews (store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS product_reviews_store_product_rating_idx ON product_reviews (store_id, product_id, rating);
CREATE INDEX IF NOT EXISTS product_reviews_customer_id_idx ON product_reviews (customer_id);
CREATE INDEX IF NOT EXISTS product_reviews_order_id_idx ON product_reviews (order_id);

-- 2. Review Moderation Logs Table (Audit trail)
CREATE TABLE IF NOT EXISTS product_review_moderation_logs (
  id UUID PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES product_reviews (id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS product_review_moderation_logs_review_idx ON product_review_moderation_logs (review_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_review_moderation_logs_store_idx ON product_review_moderation_logs (store_id, created_at DESC);

-- 3. Review Reports Table (Customer flag inappropriate content)
CREATE TABLE IF NOT EXISTS product_review_reports (
  id UUID PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES product_reviews (id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  reporter_customer_id UUID REFERENCES customers (id) ON DELETE SET NULL,
  reporter_ip TEXT,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS product_review_reports_review_idx ON product_review_reports (review_id);
CREATE INDEX IF NOT EXISTS product_review_reports_store_idx ON product_review_reports (store_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS product_review_reports_customer_unique_idx 
  ON product_review_reports (review_id, reporter_customer_id) 
  WHERE reporter_customer_id IS NOT NULL;
