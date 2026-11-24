-- 0057_add_webhook_deliveries_idempotency_index.sql
-- Add unique index on (subscription_id, event_id) to ensure idempotent webhook deliveries
CREATE UNIQUE INDEX IF NOT EXISTS webhook_deliveries_subscription_event_unique_idx
  ON webhook_deliveries (subscription_id, event_id);
