-- Migration: 0019_expand_notification_outbox.sql
-- Description: Extends notification_outbox table with provider message tracking,
--              error categorization, merchant notification types, and operational observability index.

-- 1. Add provider message ID and error categorization columns
ALTER TABLE notification_outbox
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS error_category TEXT;

-- 2. Drop existing notification type check constraint and re-add with merchant types
ALTER TABLE notification_outbox
  DROP CONSTRAINT IF EXISTS notification_outbox_type_check;

ALTER TABLE notification_outbox
  ADD CONSTRAINT notification_outbox_type_check CHECK (notification_type IN (
    'ORDER_CONFIRMATION',
    'ORDER_FULFILLMENT',
    'ORDER_CANCELLED',
    'REFUND_CONFIRMATION',
    'MERCHANT_NEW_ORDER',
    'LOW_STOCK_ALERT'
  ));

-- 3. Composite index for merchant operational visibility queries (store-scoped listing by status and time)
CREATE INDEX IF NOT EXISTS notification_outbox_store_status_idx
  ON notification_outbox (store_id, status, created_at DESC);
