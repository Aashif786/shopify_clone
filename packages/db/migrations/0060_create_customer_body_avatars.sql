-- Migration: 0060_create_customer_body_avatars.sql
-- Description: Persisted parametric avatar derived from a customer's body profile.
-- Sensitive: derived from body measurements. Cascades with the customer and is
-- explicitly deleted together with the body profile.

CREATE TABLE customer_body_avatars (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL,
  generator_version INT NOT NULL,
  params JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_body_avatars_store_customer_fkey FOREIGN KEY (customer_id, store_id)
    REFERENCES customers (id, store_id) ON DELETE CASCADE,
  CONSTRAINT customer_body_avatars_customer_unique UNIQUE (store_id, customer_id)
);

CREATE INDEX customer_body_avatars_store_id_idx ON customer_body_avatars (store_id);
