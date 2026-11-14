-- Migration: 0049_create_gift_card_recipients.sql
-- Description: Stores gift card recipient email, name, and message when purchasing digital gift cards
--              and links them through cart, checkout, and order for delivery to the intended recipient.

CREATE TABLE IF NOT EXISTS gift_card_recipients (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  cart_id UUID NULL REFERENCES carts (id) ON DELETE CASCADE,
  checkout_id UUID NULL REFERENCES checkouts (id) ON DELETE CASCADE,
  order_id UUID NULL REFERENCES orders (id) ON DELETE CASCADE,
  variant_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NULL,
  message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gift_card_recipients_cart_variant_unique UNIQUE (cart_id, variant_id)
);

CREATE INDEX IF NOT EXISTS gift_card_recipients_store_cart_idx ON gift_card_recipients (store_id, cart_id);
CREATE INDEX IF NOT EXISTS gift_card_recipients_store_checkout_idx ON gift_card_recipients (store_id, checkout_id);
CREATE INDEX IF NOT EXISTS gift_card_recipients_store_order_idx ON gift_card_recipients (store_id, order_id);
