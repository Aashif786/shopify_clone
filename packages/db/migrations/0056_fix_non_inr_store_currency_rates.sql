-- Migration: 0056_fix_non_inr_store_currency_rates.sql
-- Description: Re-normalize store_currencies for non-INR stores where exchange rates
--              were incorrectly seeded relative to INR instead of the store's base currency.

-- 1. Re-normalize store_currencies for stores where the base currency rate is not 1.0
WITH base_rates AS (
  SELECT
    sc.store_id,
    s.currency AS base_currency,
    sc.exchange_rate AS base_rate
  FROM store_currencies sc
  JOIN stores s ON s.id = sc.store_id AND s.currency = sc.currency
  WHERE sc.exchange_rate <> 1.000000 AND sc.exchange_rate > 0
)
UPDATE store_currencies sc
SET
  exchange_rate = CASE
    WHEN sc.currency = br.base_currency THEN 1.000000
    ELSE GREATEST(0.000001, ROUND((sc.exchange_rate / br.base_rate), 6))
  END,
  is_enabled = CASE
    WHEN sc.currency = br.base_currency THEN true
    ELSE sc.is_enabled
  END,
  updated_at = NOW()
FROM base_rates br
WHERE sc.store_id = br.store_id;

-- 2. Ensure every existing store has an enabled row for its own base currency with exchange_rate = 1.000000
INSERT INTO store_currencies (store_id, currency, exchange_rate, rounding_rule, is_enabled, created_at, updated_at)
SELECT
  s.id,
  s.currency,
  1.000000,
  'NONE',
  true,
  NOW(),
  NOW()
FROM stores s
ON CONFLICT (store_id, currency) DO UPDATE
SET
  exchange_rate = 1.000000,
  is_enabled = true,
  updated_at = NOW();
