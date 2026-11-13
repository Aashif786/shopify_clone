-- Migration: 0045_create_store_currencies.sql
-- Description: Multi-currency presentment and exchange rates for storefronts and merchant administration.
--              Stores maintain an authoritative base settlement currency (stores.currency), while
--              store_currencies allows localized display and conversions for international customers.

CREATE TABLE store_currencies (
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  exchange_rate NUMERIC(14, 6) NOT NULL,
  rounding_rule TEXT NOT NULL DEFAULT 'NONE',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT store_currencies_pkey PRIMARY KEY (store_id, currency),
  CONSTRAINT store_currencies_currency_code_check CHECK (
    currency = upper(currency) AND char_length(currency) = 3
  ),
  CONSTRAINT store_currencies_exchange_rate_check CHECK (exchange_rate > 0),
  CONSTRAINT store_currencies_rounding_rule_check CHECK (
    rounding_rule IN ('NONE', 'NINETY_NINE', 'INTEGER')
  )
);

CREATE INDEX store_currencies_store_enabled_idx ON store_currencies (store_id, is_enabled);

-- Pre-populate standard presentment currencies for existing stores
INSERT INTO store_currencies (store_id, currency, exchange_rate, is_enabled)
SELECT 
  s.id,
  c.currency,
  c.rate,
  true
FROM stores s
CROSS JOIN (VALUES 
  ('USD', 0.011905::numeric),
  ('EUR', 0.010989::numeric),
  ('GBP', 0.009434::numeric),
  ('AED', 0.043668::numeric),
  ('INR', 1.000000::numeric)
) AS c(currency, rate)
ON CONFLICT (store_id, currency) DO NOTHING;
