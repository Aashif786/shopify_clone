-- Migration: 0010_create_orders_schema.sql
-- Description: Creates orders, order_items, order_addresses, and order_status_history tables with tenant isolation,
--              financial integrity constraints, immutable historical snapshots, and resolves deferred foreign keys
--              from payments and refunds to orders.

-- 1. Orders Table
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  customer_id UUID,
  checkout_id UUID,
  payment_id UUID,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  fulfillment_status TEXT NOT NULL DEFAULT 'UNFULFILLED',
  currency TEXT NOT NULL,
  subtotal BIGINT NOT NULL DEFAULT 0,
  discount_total BIGINT NOT NULL DEFAULT 0,
  shipping_total BIGINT NOT NULL DEFAULT 0,
  tax_total BIGINT NOT NULL DEFAULT 0,
  total BIGINT NOT NULL DEFAULT 0,
  grand_total BIGINT NOT NULL DEFAULT 0,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT orders_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT orders_store_customer_fkey FOREIGN KEY (customer_id, store_id)
    REFERENCES customers (id, store_id) ON DELETE SET NULL (customer_id),
  CONSTRAINT orders_store_checkout_fkey FOREIGN KEY (checkout_id, store_id)
    REFERENCES checkouts (id, store_id) ON DELETE RESTRICT,
  CONSTRAINT orders_store_payment_fkey FOREIGN KEY (payment_id, store_id)
    REFERENCES payments (id, store_id) ON DELETE SET NULL (payment_id),
  CONSTRAINT orders_store_order_number_unique UNIQUE (store_id, order_number),
  CONSTRAINT orders_status_check CHECK (status IN (
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'COMPLETED'
  )),
  CONSTRAINT orders_payment_status_check CHECK (payment_status IN (
    'PENDING',
    'AUTHORIZED',
    'PAID',
    'PARTIALLY_REFUNDED',
    'REFUNDED',
    'FAILED'
  )),
  CONSTRAINT orders_fulfillment_status_check CHECK (fulfillment_status IN (
    'UNFULFILLED',
    'PARTIALLY_FULFILLED',
    'FULFILLED',
    'CANCELLED'
  )),
  CONSTRAINT orders_currency_format_check CHECK (currency = UPPER(TRIM(currency)) AND LENGTH(currency) = 3),
  CONSTRAINT orders_subtotal_check CHECK (subtotal >= 0),
  CONSTRAINT orders_discount_total_check CHECK (discount_total >= 0),
  CONSTRAINT orders_shipping_total_check CHECK (shipping_total >= 0),
  CONSTRAINT orders_tax_total_check CHECK (tax_total >= 0),
  CONSTRAINT orders_total_check CHECK (total >= 0),
  CONSTRAINT orders_grand_total_check CHECK (grand_total >= 0)
);

CREATE INDEX orders_store_id_idx ON orders (store_id);
CREATE INDEX orders_customer_id_idx ON orders (customer_id);
CREATE INDEX orders_checkout_id_idx ON orders (checkout_id);
CREATE INDEX orders_payment_id_idx ON orders (payment_id);
CREATE INDEX orders_store_status_idx ON orders (store_id, status);
CREATE INDEX orders_store_created_at_idx ON orders (store_id, created_at DESC);
CREATE UNIQUE INDEX orders_store_checkout_idx ON orders (store_id, checkout_id)
  WHERE checkout_id IS NOT NULL;

-- 2. Order Items Table
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  product_id UUID REFERENCES products (id) ON DELETE SET NULL,
  variant_id UUID,
  product_name_snapshot TEXT NOT NULL,
  variant_name_snapshot TEXT NOT NULL,
  sku_snapshot TEXT,
  quantity INT NOT NULL,
  unit_price BIGINT NOT NULL DEFAULT 0,
  discount_amount BIGINT NOT NULL DEFAULT 0,
  tax_amount BIGINT NOT NULL DEFAULT 0,
  line_total BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_items_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT order_items_order_store_fkey FOREIGN KEY (order_id, store_id)
    REFERENCES orders (id, store_id) ON DELETE CASCADE,
  CONSTRAINT order_items_variant_store_fkey FOREIGN KEY (variant_id, store_id)
    REFERENCES product_variants (id, store_id) ON DELETE SET NULL,
  CONSTRAINT order_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT order_items_unit_price_check CHECK (unit_price >= 0),
  CONSTRAINT order_items_discount_amount_check CHECK (discount_amount >= 0),
  CONSTRAINT order_items_tax_amount_check CHECK (tax_amount >= 0),
  CONSTRAINT order_items_line_total_check CHECK (line_total >= 0)
);

CREATE INDEX order_items_order_id_idx ON order_items (order_id);
CREATE INDEX order_items_store_id_idx ON order_items (store_id);
CREATE INDEX order_items_product_id_idx ON order_items (product_id);
CREATE INDEX order_items_variant_id_idx ON order_items (variant_id);

-- 3. Order Addresses Table
CREATE TABLE order_addresses (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_addresses_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT order_addresses_order_store_fkey FOREIGN KEY (order_id, store_id)
    REFERENCES orders (id, store_id) ON DELETE CASCADE,
  CONSTRAINT order_addresses_order_type_unique UNIQUE (order_id, type),
  CONSTRAINT order_addresses_type_check CHECK (type IN ('BILLING', 'SHIPPING'))
);

CREATE INDEX order_addresses_order_id_idx ON order_addresses (order_id);
CREATE INDEX order_addresses_store_id_idx ON order_addresses (store_id);

-- 4. Order Status History Table
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  actor_type TEXT NOT NULL DEFAULT 'SYSTEM',
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_status_history_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT order_status_history_order_store_fkey FOREIGN KEY (order_id, store_id)
    REFERENCES orders (id, store_id) ON DELETE CASCADE,
  CONSTRAINT order_status_history_actor_type_check CHECK (actor_type IN ('CUSTOMER', 'MERCHANT', 'SYSTEM'))
);

CREATE INDEX order_status_history_order_id_idx ON order_status_history (order_id);
CREATE INDEX order_status_history_store_id_idx ON order_status_history (store_id);
CREATE INDEX order_status_history_created_at_idx ON order_status_history (created_at DESC);

-- 5. Resolve Deferred Foreign Keys from Payments and Refunds to Orders
ALTER TABLE payments
  ADD CONSTRAINT payments_order_store_fkey FOREIGN KEY (order_id, store_id)
    REFERENCES orders (id, store_id) ON DELETE SET NULL (order_id);

ALTER TABLE refunds
  ADD CONSTRAINT refunds_order_store_fkey FOREIGN KEY (order_id, store_id)
    REFERENCES orders (id, store_id) ON DELETE RESTRICT;
