-- Migration: 0006_create_customers_schema.sql
-- Description: Creates customers and customer_addresses tables with store-level tenant isolation, constraints, and indexes.

CREATE TABLE customers (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customers_store_email_unique UNIQUE (store_id, email),
  CONSTRAINT customers_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT customers_status_check CHECK (status IN ('ACTIVE', 'DISABLED')),
  CONSTRAINT customers_email_normalized_check CHECK (email = LOWER(TRIM(email)) AND LENGTH(email) > 0)
);

CREATE INDEX customers_store_id_idx ON customers (store_id);
CREATE INDEX customers_store_id_status_idx ON customers (store_id, status);
CREATE INDEX customers_store_id_created_idx ON customers (store_id, created_at);
CREATE UNIQUE INDEX customers_store_user_idx ON customers (store_id, user_id) WHERE user_id IS NOT NULL;

CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  phone TEXT,
  label TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_addresses_store_customer_fkey FOREIGN KEY (customer_id, store_id)
    REFERENCES customers (id, store_id) ON DELETE CASCADE,
  CONSTRAINT customer_addresses_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT customer_addresses_line1_check CHECK (LENGTH(TRIM(address_line_1)) > 0),
  CONSTRAINT customer_addresses_city_check CHECK (LENGTH(TRIM(city)) > 0),
  CONSTRAINT customer_addresses_postal_code_check CHECK (LENGTH(TRIM(postal_code)) > 0),
  CONSTRAINT customer_addresses_country_check CHECK (LENGTH(TRIM(country)) > 0)
);

CREATE INDEX customer_addresses_store_id_idx ON customer_addresses (store_id);
CREATE INDEX customer_addresses_customer_id_idx ON customer_addresses (customer_id);
CREATE UNIQUE INDEX customer_addresses_customer_default_idx ON customer_addresses (customer_id) WHERE is_default = TRUE;
