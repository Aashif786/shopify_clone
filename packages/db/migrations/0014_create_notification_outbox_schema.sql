-- Migration: 0014_create_notification_outbox_schema.sql
-- Description: Creates notification_outbox table for durable, idempotent transactional
--              order lifecycle email notifications (confirmation, fulfillment, cancellation, refund).

CREATE TABLE notification_outbox (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  recipient_email TEXT,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_outbox_store_idempotency_key_unique UNIQUE (store_id, idempotency_key),
  CONSTRAINT notification_outbox_status_check CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
  CONSTRAINT notification_outbox_type_check CHECK (notification_type IN (
    'ORDER_CONFIRMATION',
    'ORDER_FULFILLMENT',
    'ORDER_CANCELLED',
    'REFUND_CONFIRMATION'
  ))
);

-- Fast lookup for the worker polling pending notifications due for delivery
CREATE INDEX notification_outbox_pending_retry_idx
  ON notification_outbox (next_retry_at, created_at)
  WHERE status = 'PENDING';

-- Tenant isolation and store lookup index
CREATE INDEX notification_outbox_store_reference_idx
  ON notification_outbox (store_id, reference_type, reference_id);
