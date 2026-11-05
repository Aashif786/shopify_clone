-- Migration: 0035_create_returns_schema.sql
-- Description: Creates the customer-initiated returns / RMA domain (GAP-13):
--              return_policies (per-store return window), return_requests (state machine),
--              return_request_items (returned line items), and return_request_events (audit trail).
--              Also extends the notification_outbox type constraint with the return lifecycle types.
--
-- Tenant isolation: every table carries store_id and every cross-table reference uses a
-- composite (id, store_id) foreign key, so a return request can never be attached to an
-- order, order item, customer, or refund belonging to a different store.

-- ---------------------------------------------------------------------------
-- 1. Return policies (per-store return window, owned by modules/returns)
--    A store with no row uses the module default; no row needs to exist for
--    returns to work.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS return_policies (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  is_returns_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  return_window_days INT NOT NULL DEFAULT 14,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT return_policies_store_id_unique UNIQUE (store_id),
  CONSTRAINT return_policies_window_days_check CHECK (
    return_window_days >= 0 AND return_window_days <= 365
  )
);

CREATE INDEX IF NOT EXISTS return_policies_store_id_idx ON return_policies (store_id);

-- ---------------------------------------------------------------------------
-- 2. Return requests (state machine:
--    REQUESTED -> APPROVED | REJECTED, APPROVED -> RECEIVED, RECEIVED -> REFUNDED,
--    REQUESTED -> CANCELLED by the customer)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS return_requests (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  customer_id UUID,
  return_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  reason TEXT NOT NULL,
  customer_note TEXT,
  merchant_note TEXT,
  currency TEXT NOT NULL,
  requested_amount BIGINT NOT NULL DEFAULT 0,
  refunded_amount BIGINT,
  refund_id UUID,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT return_requests_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT return_requests_store_number_unique UNIQUE (store_id, return_number),
  CONSTRAINT return_requests_order_store_fkey FOREIGN KEY (order_id, store_id)
    REFERENCES orders (id, store_id) ON DELETE CASCADE,
  CONSTRAINT return_requests_customer_store_fkey FOREIGN KEY (customer_id, store_id)
    REFERENCES customers (id, store_id) ON DELETE SET NULL (customer_id),
  CONSTRAINT return_requests_refund_store_fkey FOREIGN KEY (refund_id, store_id)
    REFERENCES refunds (id, store_id) ON DELETE SET NULL (refund_id),
  CONSTRAINT return_requests_status_check CHECK (status IN (
    'REQUESTED',
    'APPROVED',
    'REJECTED',
    'RECEIVED',
    'REFUNDED',
    'CANCELLED'
  )),
  CONSTRAINT return_requests_currency_format_check CHECK (
    currency = UPPER(TRIM(currency)) AND LENGTH(currency) = 3
  ),
  CONSTRAINT return_requests_reason_length_check CHECK (
    char_length(reason) >= 1 AND char_length(reason) <= 500
  ),
  CONSTRAINT return_requests_requested_amount_check CHECK (requested_amount >= 0),
  CONSTRAINT return_requests_refunded_amount_check CHECK (
    refunded_amount IS NULL OR refunded_amount >= 0
  )
);

-- Merchant review queue: store-scoped listing by status, newest first.
CREATE INDEX IF NOT EXISTS return_requests_store_status_created_idx
  ON return_requests (store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS return_requests_order_idx ON return_requests (order_id);
CREATE INDEX IF NOT EXISTS return_requests_customer_idx ON return_requests (customer_id);
CREATE INDEX IF NOT EXISTS return_requests_refund_idx ON return_requests (refund_id);

-- At most one in-flight return request per order. Terminal states
-- (REJECTED, REFUNDED, CANCELLED) free the order for a fresh request.
CREATE UNIQUE INDEX IF NOT EXISTS return_requests_one_open_per_order_idx
  ON return_requests (store_id, order_id)
  WHERE status IN ('REQUESTED', 'APPROVED', 'RECEIVED');

-- ---------------------------------------------------------------------------
-- 3. Return request items (which order lines, and how many of each)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS return_request_items (
  id UUID PRIMARY KEY,
  return_request_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL,
  quantity INT NOT NULL,
  unit_price_snapshot BIGINT NOT NULL DEFAULT 0,
  line_refund_amount BIGINT NOT NULL DEFAULT 0,
  product_name_snapshot TEXT NOT NULL,
  variant_name_snapshot TEXT,
  sku_snapshot TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT return_request_items_request_item_unique UNIQUE (return_request_id, order_item_id),
  CONSTRAINT return_request_items_request_store_fkey FOREIGN KEY (return_request_id, store_id)
    REFERENCES return_requests (id, store_id) ON DELETE CASCADE,
  CONSTRAINT return_request_items_order_item_store_fkey FOREIGN KEY (order_item_id, store_id)
    REFERENCES order_items (id, store_id) ON DELETE RESTRICT,
  CONSTRAINT return_request_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT return_request_items_unit_price_check CHECK (unit_price_snapshot >= 0),
  CONSTRAINT return_request_items_line_refund_check CHECK (line_refund_amount >= 0)
);

CREATE INDEX IF NOT EXISTS return_request_items_request_idx
  ON return_request_items (return_request_id);
CREATE INDEX IF NOT EXISTS return_request_items_store_idx
  ON return_request_items (store_id);
CREATE INDEX IF NOT EXISTS return_request_items_order_item_idx
  ON return_request_items (order_item_id);

-- ---------------------------------------------------------------------------
-- 4. Return request events (append-only audit trail of status transitions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS return_request_events (
  id UUID PRIMARY KEY,
  return_request_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT return_request_events_request_store_fkey FOREIGN KEY (return_request_id, store_id)
    REFERENCES return_requests (id, store_id) ON DELETE CASCADE,
  CONSTRAINT return_request_events_actor_type_check CHECK (actor_type IN (
    'CUSTOMER',
    'MERCHANT',
    'SYSTEM'
  )),
  CONSTRAINT return_request_events_to_status_check CHECK (to_status IN (
    'REQUESTED',
    'APPROVED',
    'REJECTED',
    'RECEIVED',
    'REFUNDED',
    'CANCELLED'
  ))
);

CREATE INDEX IF NOT EXISTS return_request_events_request_created_idx
  ON return_request_events (return_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS return_request_events_store_created_idx
  ON return_request_events (store_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Extend notification types with the return lifecycle.
--    The refund email itself still goes out as REFUND_CONFIRMATION via the
--    existing refund path, so there is no RETURN_REFUNDED type.
-- ---------------------------------------------------------------------------
ALTER TABLE notification_outbox
  DROP CONSTRAINT IF EXISTS notification_outbox_type_check;

ALTER TABLE notification_outbox
  ADD CONSTRAINT notification_outbox_type_check CHECK (notification_type IN (
    'ORDER_CONFIRMATION',
    'ORDER_FULFILLMENT',
    'ORDER_CANCELLED',
    'REFUND_CONFIRMATION',
    'MERCHANT_NEW_ORDER',
    'LOW_STOCK_ALERT',
    'RETURN_REQUESTED',
    'RETURN_APPROVED',
    'RETURN_REJECTED'
  ));
