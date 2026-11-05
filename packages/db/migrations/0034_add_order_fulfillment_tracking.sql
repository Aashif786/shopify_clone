-- Migration: 0034_add_order_fulfillment_tracking.sql
-- Description: Adds structured carrier tracking fields (carrier name, tracking number, tracking URL)
--              to the orders table so fulfillment tracking is persisted as first-class, queryable
--              data instead of being concatenated into status-history reason strings.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_carrier TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
