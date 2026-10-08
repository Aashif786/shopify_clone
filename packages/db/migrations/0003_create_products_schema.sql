CREATE TABLE products (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT products_store_slug_unique UNIQUE (store_id, slug),
  CONSTRAINT products_status_check CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED'))
);

CREATE INDEX products_store_id_idx ON products (store_id);
CREATE INDEX products_store_id_status_created_idx ON products (store_id, status, created_at);
CREATE INDEX products_store_id_created_idx ON products (store_id, created_at);

CREATE TABLE product_variants (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  title TEXT NOT NULL DEFAULT 'Default Title',
  sku TEXT,
  price BIGINT NOT NULL,
  compare_at_price BIGINT,
  currency TEXT NOT NULL DEFAULT 'USD',
  position INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_variants_price_check CHECK (price >= 0),
  CONSTRAINT product_variants_compare_at_price_check CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  CONSTRAINT product_variants_status_check CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED'))
);

CREATE INDEX product_variants_product_id_idx ON product_variants (product_id);
CREATE INDEX product_variants_store_id_idx ON product_variants (store_id);
CREATE UNIQUE INDEX product_variants_store_sku_idx ON product_variants (store_id, sku) WHERE sku IS NOT NULL;

CREATE TABLE product_media (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants (id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  alt_text TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX product_media_product_id_idx ON product_media (product_id);
CREATE INDEX product_media_variant_id_idx ON product_media (variant_id);
