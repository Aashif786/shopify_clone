-- Migration: 0028_create_store_domains_schema.sql
-- Description: Multi-tenant store domains and subdomains foundation

CREATE TABLE IF NOT EXISTS store_domains (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  subdomain TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  CONSTRAINT store_domains_domain_unique UNIQUE (domain),
  CONSTRAINT store_domains_type_check CHECK (
    type IN ('SUBDOMAIN', 'CUSTOM')
  ),
  CONSTRAINT store_domains_status_check CHECK (
    status IN ('PENDING', 'ACTIVE', 'FAILED')
  )
);

CREATE INDEX IF NOT EXISTS store_domains_store_id_idx ON store_domains (store_id);
CREATE INDEX IF NOT EXISTS store_domains_domain_idx ON store_domains (domain);
CREATE INDEX IF NOT EXISTS store_domains_subdomain_idx ON store_domains (subdomain);
CREATE UNIQUE INDEX IF NOT EXISTS store_domains_primary_store_idx ON store_domains (store_id) WHERE is_primary = TRUE;

-- Backfill default platform subdomains for existing active stores
INSERT INTO store_domains (
  id,
  store_id,
  domain,
  subdomain,
  type,
  status,
  is_primary,
  created_at,
  updated_at,
  verified_at
)
SELECT
  gen_random_uuid(),
  id,
  LOWER(slug) || '.calcart.com',
  LOWER(slug),
  'SUBDOMAIN',
  'ACTIVE',
  TRUE,
  NOW(),
  NOW(),
  NOW()
FROM stores
ON CONFLICT (domain) DO NOTHING;
