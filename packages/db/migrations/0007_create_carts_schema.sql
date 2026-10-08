-- Migration: 0007_create_carts_schema.sql
-- Description: Creates carts and cart_items tables with store-level tenant isolation, constraints, and indexes.

CREATE TABLE carts (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  customer_id UUID,
  guest_identifier TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal BIGINT NOT NULL DEFAULT 0,
  discount_total BIGINT NOT NULL DEFAULT 0,
  tax_total BIGINT NOT NULL DEFAULT 0,
  shipping_total BIGINT NOT NULL DEFAULT 0,
  grand_total BIGINT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT carts_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT carts_store_customer_fkey FOREIGN KEY (customer_id, store_id)
    REFERENCES customers (id, store_id) ON DELETE SET NULL (customer_id),
  CONSTRAINT carts_status_check CHECK (status IN ('ACTIVE', 'CONVERTED', 'ABANDONED', 'EXPIRED')),
  CONSTRAINT carts_currency_format_check CHECK (currency = UPPER(TRIM(currency)) AND LENGTH(currency) = 3),
  CONSTRAINT carts_subtotal_check CHECK (subtotal >= 0),
  CONSTRAINT carts_discount_total_check CHECK (discount_total >= 0),
  CONSTRAINT carts_tax_total_check CHECK (tax_total >= 0),
  CONSTRAINT carts_shipping_total_check CHECK (shipping_total >= 0),
  CONSTRAINT carts_grand_total_check CHECK (grand_total >= 0)
);

CREATE INDEX carts_store_id_idx ON carts (store_id);
CREATE INDEX carts_customer_id_idx ON carts (customer_id);
CREATE INDEX carts_store_status_idx ON carts (store_id, status);
CREATE INDEX carts_guest_identifier_idx ON carts (guest_identifier) WHERE guest_identifier IS NOT NULL;
CREATE INDEX carts_expires_at_idx ON carts (expires_at) WHERE status = 'ACTIVE' AND expires_at IS NOT NULL;

CREATE TABLE cart_items (
  id UUID PRIMARY KEY,
  cart_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  variant_id UUID NOT NULL,
  quantity INT NOT NULL,
  unit_price BIGINT NOT NULL DEFAULT 0,
  line_subtotal BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cart_items_cart_store_fkey FOREIGN KEY (cart_id, store_id)
    REFERENCES carts (id, store_id) ON DELETE CASCADE,
  CONSTRAINT cart_items_variant_store_fkey FOREIGN KEY (variant_id, store_id)
    REFERENCES product_variants (id, store_id) ON DELETE RESTRICT,
  CONSTRAINT cart_items_cart_variant_unique UNIQUE (cart_id, variant_id),
  CONSTRAINT cart_items_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT cart_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT cart_items_unit_price_check CHECK (unit_price >= 0),
  CONSTRAINT cart_items_line_subtotal_check CHECK (line_subtotal >= 0)
);

CREATE INDEX cart_items_cart_id_idx ON cart_items (cart_id);
CREATE INDEX cart_items_store_id_idx ON cart_items (store_id);
CREATE INDEX cart_items_variant_id_idx ON cart_items (variant_id);
