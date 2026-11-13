-- Migration: 0042_add_gift_card_delivery_notification_type.sql
-- Description: Extends notification_outbox table to support GIFT_CARD_DELIVERY

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
    'ABANDONED_CART_RECOVERY',
    'GIFT_CARD_DELIVERY'
  ));
