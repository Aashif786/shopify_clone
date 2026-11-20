-- Migration: 0051_create_store_payment_gateways.sql
-- Description: Merchant-wise payment gateway configuration (Razorpay, etc.)
--              Allows each merchant store to onboard and manage their own payment provider credentials.

CREATE TABLE IF NOT EXISTS store_payment_gateways (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  key_id TEXT,
  key_secret TEXT,
  webhook_secret TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT store_payment_gateways_store_provider_unique UNIQUE (store_id, provider),
  CONSTRAINT store_payment_gateways_id_store_id_unique UNIQUE (id, store_id)
);

CREATE INDEX IF NOT EXISTS store_payment_gateways_store_idx
  ON store_payment_gateways (store_id, is_enabled);
