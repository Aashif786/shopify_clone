-- Migration: 0008_create_checkout_schema.sql
-- Description: Creates checkouts and checkout_items tables with store-level tenant isolation, constraints, and indexes.

CREATE TABLE checkouts (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  cart_id UUID NOT NULL,
  customer_id UUID,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal BIGINT NOT NULL DEFAULT 0,
  discount_total BIGINT NOT NULL DEFAULT 0,
  tax_total BIGINT NOT NULL DEFAULT 0,
  shipping_total BIGINT NOT NULL DEFAULT 0,
  total BIGINT NOT NULL DEFAULT 0,
  shipping_address JSONB,
  billing_address JSONB,
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT checkouts_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT checkouts_store_cart_fkey FOREIGN KEY (cart_id, store_id)
    REFERENCES carts (id, store_id) ON DELETE RESTRICT,
  CONSTRAINT checkouts_store_customer_fkey FOREIGN KEY (customer_id, store_id)
    REFERENCES customers (id, store_id) ON DELETE SET NULL (customer_id),
  CONSTRAINT checkouts_status_check CHECK (status IN ('OPEN', 'PAYMENT_PENDING', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED')),
  CONSTRAINT checkouts_payment_status_check CHECK (payment_status IN ('PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED')),
  CONSTRAINT checkouts_currency_format_check CHECK (currency = UPPER(TRIM(currency)) AND LENGTH(currency) = 3),
  CONSTRAINT checkouts_subtotal_check CHECK (subtotal >= 0),
  CONSTRAINT checkouts_discount_total_check CHECK (discount_total >= 0),
  CONSTRAINT checkouts_tax_total_check CHECK (tax_total >= 0),
  CONSTRAINT checkouts_shipping_total_check CHECK (shipping_total >= 0),
  CONSTRAINT checkouts_total_check CHECK (total >= 0)
);

CREATE INDEX checkouts_store_id_idx ON checkouts (store_id);
CREATE INDEX checkouts_cart_id_idx ON checkouts (cart_id);
CREATE INDEX checkouts_customer_id_idx ON checkouts (customer_id);
CREATE INDEX checkouts_store_status_idx ON checkouts (store_id, status);
CREATE INDEX checkouts_expires_at_idx ON checkouts (expires_at) WHERE status = 'OPEN' AND expires_at IS NOT NULL;
CREATE INDEX checkouts_store_created_at_idx ON checkouts (store_id, created_at DESC);

CREATE TABLE checkout_items (
  id UUID PRIMARY KEY,
  checkout_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  variant_id UUID NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  variant_name_snapshot TEXT NOT NULL,
  sku_snapshot TEXT,
  unit_price BIGINT NOT NULL DEFAULT 0,
  quantity INT NOT NULL,
  line_total BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT checkout_items_checkout_store_fkey FOREIGN KEY (checkout_id, store_id)
    REFERENCES checkouts (id, store_id) ON DELETE CASCADE,
  CONSTRAINT checkout_items_variant_store_fkey FOREIGN KEY (variant_id, store_id)
    REFERENCES product_variants (id, store_id) ON DELETE RESTRICT,
  CONSTRAINT checkout_items_checkout_variant_unique UNIQUE (checkout_id, variant_id),
  CONSTRAINT checkout_items_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT checkout_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT checkout_items_unit_price_check CHECK (unit_price >= 0),
  CONSTRAINT checkout_items_line_total_check CHECK (line_total >= 0)
);

CREATE INDEX checkout_items_checkout_id_idx ON checkout_items (checkout_id);
CREATE INDEX checkout_items_store_id_idx ON checkout_items (store_id);
CREATE INDEX checkout_items_variant_id_idx ON checkout_items (variant_id);
