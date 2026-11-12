-- Migration: 0043_create_api_keys_and_webhooks.sql
-- Description: Platform API & Ecosystem (Milestone 8, GAP-16)
--              1. store_api_keys: Per-store bearer API keys with prefix indexing & SHA-256 hash verification
--              2. webhook_subscriptions: Outbound webhook endpoints subscribed to domain event topics
--              3. webhook_deliveries: Durable outbox for asynchronous signed webhook delivery with retry backoff

-- ---------------------------------------------------------------------------
-- 1. Store API Keys
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_api_keys (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix VARCHAR(16) NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read:products', 'read:orders']::TEXT[],
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT store_api_keys_store_prefix_unique UNIQUE (store_id, key_prefix),
  CONSTRAINT store_api_keys_key_hash_unique UNIQUE (key_hash),
  CONSTRAINT store_api_keys_id_store_id_unique UNIQUE (id, store_id)
);

CREATE INDEX IF NOT EXISTS store_api_keys_store_idx
  ON store_api_keys (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS store_api_keys_hash_lookup_idx
  ON store_api_keys (key_hash)
  WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Webhook Subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  event_types TEXT[] NOT NULL DEFAULT ARRAY['order.created', 'order.paid']::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT webhook_subscriptions_store_url_unique UNIQUE (store_id, url),
  CONSTRAINT webhook_subscriptions_id_store_id_unique UNIQUE (id, store_id)
);

CREATE INDEX IF NOT EXISTS webhook_subscriptions_store_active_idx
  ON webhook_subscriptions (store_id, is_active);

-- ---------------------------------------------------------------------------
-- 3. Webhook Deliveries (Outbound Outbox Ledger)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES webhook_subscriptions (id) ON DELETE CASCADE,
  event_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_status_code INT,
  response_body TEXT,
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT webhook_deliveries_status_check CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
  CONSTRAINT webhook_deliveries_id_store_id_unique UNIQUE (id, store_id)
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_pending_claim_idx
  ON webhook_deliveries (status, next_retry_at)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS webhook_deliveries_store_created_idx
  ON webhook_deliveries (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS webhook_deliveries_subscription_created_idx
  ON webhook_deliveries (subscription_id, created_at DESC);
