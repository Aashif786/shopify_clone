-- Migration: 0017_add_discount_to_checkouts_and_orders.sql
-- Description: Adds discount_id and discount_code tracking to carts, checkouts, and orders
--              so discounts can be authoritatively tracked and redeemed across the purchase lifecycle.

ALTER TABLE carts ADD COLUMN IF NOT EXISTS discount_id UUID REFERENCES discounts(id) ON DELETE SET NULL;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS discount_code TEXT;

ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS discount_id UUID REFERENCES discounts(id) ON DELETE SET NULL;
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS discount_code TEXT;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_id UUID REFERENCES discounts(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code TEXT;

CREATE INDEX IF NOT EXISTS carts_discount_id_idx ON carts (discount_id) WHERE discount_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS checkouts_discount_id_idx ON checkouts (discount_id) WHERE discount_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_discount_id_idx ON orders (discount_id) WHERE discount_id IS NOT NULL;
