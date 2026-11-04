-- Captured payments that cannot produce an order keep status CAPTURED.
-- reconciliation_reason stops automatic retries of a workflow that cannot succeed.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS reconciliation_reason TEXT;
