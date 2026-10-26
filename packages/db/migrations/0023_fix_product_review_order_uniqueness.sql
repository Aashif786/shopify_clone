-- Migration: 0023_fix_product_review_order_uniqueness.sql
-- Description: Replace restrictive (store_id, customer_id, order_id) uniqueness with (store_id, customer_id, order_id, product_id)
-- Allows customers to review multiple distinct products from the same order while preventing duplicate reviews for the same product purchase.

-- 1. Safety check: ensure no duplicate reviews exist for the same customer, order, and product
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM product_reviews
    WHERE customer_id IS NOT NULL AND order_id IS NOT NULL
    GROUP BY store_id, customer_id, order_id, product_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot apply unique index: duplicate reviews exist for the same customer, order, and product';
  END IF;
END $$;

-- 2. Drop any legacy or overly restrictive partial unique indexes or constraints on (store_id, customer_id, order_id)
DROP INDEX IF EXISTS product_reviews_verified_order_unique_idx;
DROP INDEX IF EXISTS product_reviews_order_unique_idx;
DROP INDEX IF EXISTS product_reviews_store_customer_order_unique_idx;

-- 3. Create the corrected partial unique index on (store_id, customer_id, order_id, product_id)
CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_verified_order_unique_idx
  ON product_reviews (store_id, customer_id, order_id, product_id)
  WHERE customer_id IS NOT NULL AND order_id IS NOT NULL;
