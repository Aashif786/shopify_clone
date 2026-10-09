-- Migration: 0009_create_payments_schema.sql
-- Description: Creates payments, payment_attempts, payment_webhook_events, refunds, and idempotency_records tables with store-level tenant isolation, financial integrity constraints, and partial indexes.

-- 1. Payments Table
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  checkout_id UUID NOT NULL,
  order_id UUID,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED',
  provider TEXT NOT NULL DEFAULT 'razorpay',
  captured_amount BIGINT NOT NULL DEFAULT 0,
  refunded_amount BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT payments_checkout_store_fkey FOREIGN KEY (checkout_id, store_id)
    REFERENCES checkouts (id, store_id) ON DELETE RESTRICT,
  CONSTRAINT payments_status_check CHECK (status IN (
    'CREATED',
    'PENDING',
    'PROCESSING',
    'AUTHORIZED',
    'CAPTURED',
    'FAILED',
    'CANCELLED',
    'REQUIRES_RECONCILIATION',
    'PARTIALLY_REFUNDED',
    'REFUNDED'
  )),
  CONSTRAINT payments_currency_format_check CHECK (currency = UPPER(TRIM(currency)) AND LENGTH(currency) = 3),
  CONSTRAINT payments_amount_check CHECK (amount > 0),
  CONSTRAINT payments_captured_amount_check CHECK (captured_amount >= 0 AND captured_amount <= amount),
  CONSTRAINT payments_refunded_amount_check CHECK (refunded_amount >= 0 AND refunded_amount <= captured_amount)
);

CREATE INDEX payments_store_id_idx ON payments (store_id);
CREATE INDEX payments_checkout_id_idx ON payments (checkout_id);
CREATE INDEX payments_order_id_idx ON payments (order_id);
CREATE INDEX payments_store_status_idx ON payments (store_id, status);
CREATE INDEX payments_store_created_at_idx ON payments (store_id, created_at DESC);

-- Partial unique index ensuring at most ONE active payment per checkout while allowing retries after failure or cancellation
CREATE UNIQUE INDEX payments_active_checkout_idx ON payments (store_id, checkout_id)
  WHERE status NOT IN ('FAILED', 'CANCELLED');

-- 2. Payment Attempts Table
CREATE TABLE payment_attempts (
  id UUID PRIMARY KEY,
  payment_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  attempt_number INT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_order_id TEXT,
  provider_payment_id TEXT,
  provider_signature TEXT,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'INITIATED',
  failure_code TEXT,
  failure_message TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_attempts_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT payment_attempts_payment_store_fkey FOREIGN KEY (payment_id, store_id)
    REFERENCES payments (id, store_id) ON DELETE CASCADE,
  CONSTRAINT payment_attempts_payment_attempt_unique UNIQUE (payment_id, attempt_number),
  CONSTRAINT payment_attempts_status_check CHECK (status IN (
    'INITIATED',
    'PENDING',
    'AUTHORIZED',
    'CAPTURED',
    'FAILED',
    'CANCELLED',
    'REQUIRES_RECONCILIATION'
  )),
  CONSTRAINT payment_attempts_currency_format_check CHECK (currency = UPPER(TRIM(currency)) AND LENGTH(currency) = 3),
  CONSTRAINT payment_attempts_amount_check CHECK (amount > 0)
);

CREATE INDEX payment_attempts_payment_id_idx ON payment_attempts (payment_id);
CREATE INDEX payment_attempts_store_id_idx ON payment_attempts (store_id);
CREATE INDEX payment_attempts_provider_order_idx ON payment_attempts (provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;
CREATE UNIQUE INDEX payment_attempts_provider_payment_idx ON payment_attempts (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- 3. Payment Webhook Events Table
CREATE TABLE payment_webhook_events (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores (id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL,
  payment_id UUID,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_webhook_events_provider_event_id_unique UNIQUE (provider, provider_event_id),
  CONSTRAINT payment_webhook_events_status_check CHECK (status IN (
    'RECEIVED',
    'PROCESSING',
    'PROCESSED',
    'IGNORED',
    'FAILED'
  ))
);

CREATE INDEX payment_webhook_events_store_id_idx ON payment_webhook_events (store_id);
CREATE INDEX payment_webhook_events_payment_id_idx ON payment_webhook_events (payment_id);
CREATE INDEX payment_webhook_events_status_idx ON payment_webhook_events (status);

-- 4. Refunds Table
CREATE TABLE refunds (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  payment_id UUID NOT NULL,
  order_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_refund_id TEXT,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  reason TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT refunds_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT refunds_payment_store_fkey FOREIGN KEY (payment_id, store_id)
    REFERENCES payments (id, store_id) ON DELETE RESTRICT,
  CONSTRAINT refunds_amount_check CHECK (amount > 0),
  CONSTRAINT refunds_currency_format_check CHECK (currency = UPPER(TRIM(currency)) AND LENGTH(currency) = 3),
  CONSTRAINT refunds_status_check CHECK (status IN (
    'PENDING',
    'PROCESSING',
    'SUCCEEDED',
    'FAILED',
    'REQUIRES_RECONCILIATION'
  ))
);

CREATE INDEX refunds_store_id_idx ON refunds (store_id);
CREATE INDEX refunds_payment_id_idx ON refunds (payment_id);
CREATE INDEX refunds_order_id_idx ON refunds (order_id);
CREATE INDEX refunds_store_status_idx ON refunds (store_id, status);
CREATE UNIQUE INDEX refunds_idempotency_idx ON refunds (store_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX refunds_provider_refund_idx ON refunds (provider, provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;

-- 5. Idempotency Records Table
CREATE TABLE idempotency_records (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  response_status INT,
  response_body JSONB,
  resource_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT idempotency_records_store_scope_key_unique UNIQUE (store_id, scope, idempotency_key),
  CONSTRAINT idempotency_records_status_check CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED'))
);

CREATE INDEX idempotency_records_store_idx ON idempotency_records (store_id);
CREATE INDEX idempotency_records_expires_at_idx ON idempotency_records (expires_at);
