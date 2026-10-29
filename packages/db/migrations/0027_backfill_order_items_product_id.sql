-- Migration: 0027_backfill_order_items_product_id.sql
-- Description: Backfill product_id on order_items from product_variants for historical order items where product_id was null.

UPDATE order_items oi
SET product_id = pv.product_id
FROM product_variants pv
WHERE oi.variant_id = pv.id
  AND oi.product_id IS NULL;
