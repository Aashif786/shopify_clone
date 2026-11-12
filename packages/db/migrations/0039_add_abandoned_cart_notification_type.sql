-- Migration: 0039_add_abandoned_cart_notification_type.sql
-- Description: Extends notification_outbox table to support ABANDONED_CART_RECOVERY
--              and adds index on carts for efficient lifecycle and cleanup queries.

-- 1. Extend notification_outbox_type_check constraint
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
    'RETURN_REJECTED',
    'ABANDONED_CART_RECOVERY'
  ));

-- 2. Performance index for cart lifecycle and cleanup queries
CREATE INDEX IF NOT EXISTS carts_lifecycle_idx
  ON carts (status, updated_at);
