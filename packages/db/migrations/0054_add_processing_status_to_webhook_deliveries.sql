-- 0054_add_processing_status_to_webhook_deliveries.sql
-- Allow 'PROCESSING' status in webhook_deliveries for atomic leases and safe concurrent worker claiming

ALTER TABLE webhook_deliveries
  DROP CONSTRAINT IF EXISTS webhook_deliveries_status_check;

ALTER TABLE webhook_deliveries
  ADD CONSTRAINT webhook_deliveries_status_check
  CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'));

-- Index supporting stale PROCESSING lease recovery
CREATE INDEX IF NOT EXISTS webhook_deliveries_processing_recovery_idx
  ON webhook_deliveries (status, updated_at)
  WHERE status = 'PROCESSING';
