-- Migration: 0011_create_discounts_schema.sql
-- Description: Creates discounts and discount_redemptions tables with tenant isolation,
--              monetary integrity constraints, usage limits, and concurrency tracking.

-- 1. Discounts Table
CREATE TABLE discounts (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  value BIGINT NOT NULL,
  currency TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  minimum_subtotal BIGINT NOT NULL DEFAULT 0,
  max_discount_amount BIGINT,
  usage_limit INT,
  usage_count INT NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT discounts_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT discounts_store_code_unique UNIQUE (store_id, code),
  CONSTRAINT discounts_code_normalized_check CHECK (code = UPPER(TRIM(code)) AND LENGTH(code) >= 1),
  CONSTRAINT discounts_name_check CHECK (LENGTH(TRIM(name)) >= 1),
  CONSTRAINT discounts_type_check CHECK (type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
  CONSTRAINT discounts_status_check CHECK (status IN ('DRAFT', 'ACTIVE', 'DISABLED', 'EXPIRED')),
  CONSTRAINT discounts_value_check CHECK (value > 0),
  CONSTRAINT discounts_percentage_value_check CHECK (type != 'PERCENTAGE' OR (value > 0 AND value <= 100)),
  CONSTRAINT discounts_fixed_currency_check CHECK (type != 'FIXED_AMOUNT' OR currency IS NOT NULL),
  CONSTRAINT discounts_currency_format_check CHECK (currency IS NULL OR (currency = UPPER(TRIM(currency)) AND LENGTH(currency) = 3)),
  CONSTRAINT discounts_minimum_subtotal_check CHECK (minimum_subtotal >= 0),
  CONSTRAINT discounts_max_discount_amount_check CHECK (max_discount_amount IS NULL OR max_discount_amount > 0),
  CONSTRAINT discounts_usage_limit_check CHECK (usage_limit IS NULL OR usage_limit > 0),
  CONSTRAINT discounts_usage_count_check CHECK (usage_count >= 0),
  CONSTRAINT discounts_time_window_check CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at)
);

CREATE INDEX discounts_store_id_idx ON discounts (store_id);
CREATE INDEX discounts_store_code_idx ON discounts (store_id, code);
CREATE INDEX discounts_store_status_idx ON discounts (store_id, status);
CREATE INDEX discounts_time_window_idx ON discounts (store_id, starts_at, ends_at) WHERE status = 'ACTIVE';

-- 2. Discount Redemptions Table
CREATE TABLE discount_redemptions (
  id UUID PRIMARY KEY,
  discount_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  order_id UUID,
  checkout_id UUID,
  customer_id UUID,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT discount_redemptions_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT discount_redemptions_discount_store_fkey FOREIGN KEY (discount_id, store_id)
    REFERENCES discounts (id, store_id) ON DELETE RESTRICT,
  CONSTRAINT discount_redemptions_discount_order_unique UNIQUE (discount_id, order_id),
  CONSTRAINT discount_redemptions_amount_check CHECK (amount > 0),
  CONSTRAINT discount_redemptions_currency_format_check CHECK (currency = UPPER(TRIM(currency)) AND LENGTH(currency) = 3)
);

CREATE INDEX discount_redemptions_store_id_idx ON discount_redemptions (store_id);
CREATE INDEX discount_redemptions_discount_id_idx ON discount_redemptions (discount_id);
CREATE INDEX discount_redemptions_order_id_idx ON discount_redemptions (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX discount_redemptions_checkout_id_idx ON discount_redemptions (checkout_id) WHERE checkout_id IS NOT NULL;
