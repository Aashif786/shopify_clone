-- Migration: 0059_create_customer_body_profiles.sql
-- Description: Sensitive Fit Check body measurements, owned by a customer within one store.
-- Measurements are stored in metric units; unit_preference only controls display.

CREATE TABLE customer_body_profiles (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL,
  height_cm NUMERIC(5, 1) NOT NULL,
  weight_kg NUMERIC(5, 1) NOT NULL,
  chest_cm NUMERIC(5, 1) NOT NULL,
  waist_cm NUMERIC(5, 1) NOT NULL,
  hip_cm NUMERIC(5, 1) NOT NULL,
  unit_preference TEXT NOT NULL DEFAULT 'metric',
  consent_acknowledged_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_body_profiles_store_customer_fkey FOREIGN KEY (customer_id, store_id)
    REFERENCES customers (id, store_id) ON DELETE CASCADE,
  CONSTRAINT customer_body_profiles_customer_unique UNIQUE (store_id, customer_id),
  CONSTRAINT customer_body_profiles_height_check CHECK (height_cm BETWEEN 100 AND 250),
  CONSTRAINT customer_body_profiles_weight_check CHECK (weight_kg BETWEEN 25 AND 300),
  CONSTRAINT customer_body_profiles_chest_check CHECK (chest_cm BETWEEN 50 AND 200),
  CONSTRAINT customer_body_profiles_waist_check CHECK (waist_cm BETWEEN 40 AND 200),
  CONSTRAINT customer_body_profiles_hip_check CHECK (hip_cm BETWEEN 50 AND 220),
  CONSTRAINT customer_body_profiles_unit_check CHECK (unit_preference IN ('metric', 'imperial'))
);

CREATE INDEX customer_body_profiles_store_id_idx ON customer_body_profiles (store_id);
