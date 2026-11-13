-- Migration: 0037_create_shipping_schema.sql
-- Description: Creates the shipping rate engine (GAP-12, milestone M6a):
--              shipping_settings           per-store on/off switch and default parcel weight
--              shipping_zones              where a store ships, matched by country/state/PIN prefix
--              shipping_rates              priced options within a zone (weight/value bands)
--              product_shipping_profiles   per-product unit weight
--              checkout_shipping_quotes    frozen quote and selected option per checkout
--
-- Shipping is OFF by default: a store with no shipping_settings row, or
-- is_enabled = FALSE, quotes nothing and leaves checkout.shipping_total exactly
-- as it was (including a merchant-set value), so existing stores are unaffected.
--
-- Tenant isolation: every table carries store_id and every reference to another
-- module's row is a composite (id, store_id) foreign key.
--
-- Money is BIGINT minor units; weight is integer grams.

-- ---------------------------------------------------------------------------
-- 1. Settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_settings (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  -- Weight assumed for a product with no product_shipping_profiles row.
  default_weight_grams INT NOT NULL DEFAULT 500,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shipping_settings_store_id_unique UNIQUE (store_id),
  CONSTRAINT shipping_settings_default_weight_check CHECK (
    default_weight_grams >= 0 AND default_weight_grams <= 100000000
  )
);

-- ---------------------------------------------------------------------------
-- 2. Zones
--    An empty array means "any". The lowest priority number that matches wins,
--    so a narrow zone (a state, a PIN prefix) can sit ahead of a broad one.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_zones (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country_codes TEXT[] NOT NULL DEFAULT '{}',
  state_codes TEXT[] NOT NULL DEFAULT '{}',
  postal_prefixes TEXT[] NOT NULL DEFAULT '{}',
  priority INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shipping_zones_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT shipping_zones_name_check CHECK (
    char_length(btrim(name)) >= 1 AND char_length(name) <= 100
  ),
  CONSTRAINT shipping_zones_priority_check CHECK (priority >= 0 AND priority <= 100000)
);

CREATE INDEX IF NOT EXISTS shipping_zones_store_priority_idx
  ON shipping_zones (store_id, priority, created_at);

-- ---------------------------------------------------------------------------
-- 3. Rates
--    A rate applies when the parcel weight and the goods value fall inside its
--    bands. free_over_subtotal drops its price to zero above a goods value.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_rates (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  zone_id UUID NOT NULL,
  name TEXT NOT NULL,
  price BIGINT NOT NULL,
  min_weight_grams INT NOT NULL DEFAULT 0,
  max_weight_grams INT,
  min_subtotal BIGINT NOT NULL DEFAULT 0,
  max_subtotal BIGINT,
  free_over_subtotal BIGINT,
  estimated_days_min INT,
  estimated_days_max INT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shipping_rates_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT shipping_rates_zone_store_fkey FOREIGN KEY (zone_id, store_id)
    REFERENCES shipping_zones (id, store_id) ON DELETE CASCADE,
  CONSTRAINT shipping_rates_name_check CHECK (
    char_length(btrim(name)) >= 1 AND char_length(name) <= 100
  ),
  CONSTRAINT shipping_rates_price_check CHECK (price >= 0),
  CONSTRAINT shipping_rates_weight_band_check CHECK (
    min_weight_grams >= 0
    AND (max_weight_grams IS NULL OR max_weight_grams >= min_weight_grams)
  ),
  CONSTRAINT shipping_rates_subtotal_band_check CHECK (
    min_subtotal >= 0
    AND (max_subtotal IS NULL OR max_subtotal >= min_subtotal)
  ),
  CONSTRAINT shipping_rates_free_over_check CHECK (
    free_over_subtotal IS NULL OR free_over_subtotal >= 0
  ),
  CONSTRAINT shipping_rates_days_check CHECK (
    (estimated_days_min IS NULL OR estimated_days_min >= 0)
    AND (estimated_days_max IS NULL OR estimated_days_max >= 0)
    AND (
      estimated_days_min IS NULL OR estimated_days_max IS NULL
      OR estimated_days_max >= estimated_days_min
    )
  )
);

CREATE INDEX IF NOT EXISTS shipping_rates_zone_idx
  ON shipping_rates (store_id, zone_id);

-- ---------------------------------------------------------------------------
-- 4. Product weights
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_shipping_profiles (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  weight_grams INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_shipping_profiles_product_unique UNIQUE (product_id),
  CONSTRAINT product_shipping_profiles_product_store_fkey FOREIGN KEY (product_id, store_id)
    REFERENCES products (id, store_id) ON DELETE CASCADE,
  CONSTRAINT product_shipping_profiles_weight_check CHECK (
    weight_grams >= 0 AND weight_grams <= 100000000
  )
);

CREATE INDEX IF NOT EXISTS product_shipping_profiles_store_idx
  ON product_shipping_profiles (store_id);

-- ---------------------------------------------------------------------------
-- 5. Checkout quotes
--    One row per checkout, upserted on every recalculation. The selected option
--    is stored by value (name, price) as well as by id, so deleting or editing a
--    rate later cannot change a quote the customer has already accepted.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkout_shipping_quotes (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  checkout_id UUID NOT NULL,
  zone_id UUID,
  zone_name TEXT,
  selected_rate_id UUID,
  selected_rate_name TEXT,
  shipping_price BIGINT NOT NULL DEFAULT 0,
  total_weight_grams BIGINT NOT NULL DEFAULT 0,
  goods_subtotal BIGINT NOT NULL DEFAULT 0,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  destination JSONB NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT checkout_shipping_quotes_checkout_unique UNIQUE (checkout_id),
  CONSTRAINT checkout_shipping_quotes_checkout_store_fkey FOREIGN KEY (checkout_id, store_id)
    REFERENCES checkouts (id, store_id) ON DELETE CASCADE,
  CONSTRAINT checkout_shipping_quotes_amounts_check CHECK (
    shipping_price >= 0 AND total_weight_grams >= 0 AND goods_subtotal >= 0
  ),
  -- A selected option and its price always travel together.
  CONSTRAINT checkout_shipping_quotes_selection_check CHECK (
    (selected_rate_id IS NULL AND selected_rate_name IS NULL AND shipping_price = 0)
    OR (selected_rate_id IS NOT NULL AND selected_rate_name IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS checkout_shipping_quotes_store_idx
  ON checkout_shipping_quotes (store_id);
