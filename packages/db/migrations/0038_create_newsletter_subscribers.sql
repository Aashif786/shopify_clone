-- Migration: 0038_create_newsletter_subscribers.sql
-- Description: Creates the newsletter_subscribers table for storefront visitor email capture (Bug I).
-- Tenant isolation: Every subscriber is strictly scoped to store_id.
-- Idempotency: Unique constraint on (store_id, email).

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBSCRIBED',
  source TEXT NOT NULL DEFAULT 'STOREFRONT_LANDING',
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT newsletter_subscribers_store_email_unique UNIQUE (store_id, email),
  CONSTRAINT newsletter_subscribers_status_check CHECK (status IN ('SUBSCRIBED', 'UNSUBSCRIBED'))
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_store_status
  ON newsletter_subscribers (store_id, status);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_store_created
  ON newsletter_subscribers (store_id, created_at DESC);
