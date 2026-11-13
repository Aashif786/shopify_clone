-- Migration: 0047_create_checkout_store_credits.sql
-- Description: Stored-value store credit checkout application (GAP-14 / BUG-CR-02):
--              1. checkout_store_credits: in-flight checkout application of customer store credit
--              2. order_store_credits:    permanent redemption records linked to paid orders

CREATE TABLE IF NOT EXISTS checkout_store_credits (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  checkout_id UUID NOT NULL REFERENCES checkouts (id) ON DELETE CASCADE,
  store_credit_id UUID NOT NULL REFERENCES store_credits (id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  applied_amount BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT checkout_store_credits_checkout_unique UNIQUE (checkout_id),
  CONSTRAINT checkout_store_credits_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT checkout_store_credits_applied_amount_check CHECK (applied_amount > 0)
);

CREATE INDEX IF NOT EXISTS checkout_store_credits_store_checkout_idx
  ON checkout_store_credits (store_id, checkout_id);

CREATE TABLE IF NOT EXISTS order_store_credits (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  store_credit_id UUID NOT NULL REFERENCES store_credits (id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_store_credits_order_unique UNIQUE (order_id),
  CONSTRAINT order_store_credits_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT order_store_credits_amount_check CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS order_store_credits_store_order_idx
  ON order_store_credits (store_id, order_id);
