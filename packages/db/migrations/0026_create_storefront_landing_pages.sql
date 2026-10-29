CREATE TABLE IF NOT EXISTS storefront_landing_pages (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  draft_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_config JSONB,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  CONSTRAINT storefront_landing_pages_store_id_unique UNIQUE (store_id)
);

CREATE INDEX IF NOT EXISTS storefront_landing_pages_store_id_idx ON storefront_landing_pages (store_id);
