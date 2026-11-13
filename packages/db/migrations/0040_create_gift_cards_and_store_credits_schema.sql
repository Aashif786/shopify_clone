-- Migration: 0040_create_gift_cards_and_store_credits_schema.sql
-- Description: Stored-value instruments (GAP-14, milestone M7):
--              gift_cards                  digital gift cards with balances, codes, and states
--              gift_card_transactions      append-only financial ledger for gift card transactions
--              store_credits               customer-account-scoped store credit accounts
--              store_credit_transactions   append-only financial ledger for store credits
--              checkout_gift_cards         applied gift cards on in-flight checkouts
--              order_gift_cards            redeemed gift cards recorded on paid orders
--
-- Tenant isolation: every table carries store_id and composite unique/foreign keys.
-- Money is integer minor units (BIGINT).
-- Balances enforce non-negativity via CHECK (current_balance >= 0).

-- ---------------------------------------------------------------------------
-- 1. Gift Cards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gift_cards (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  initial_balance BIGINT NOT NULL,
  current_balance BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  customer_id UUID NULL REFERENCES customers (id) ON DELETE SET NULL,
  recipient_email TEXT NULL,
  recipient_name TEXT NULL,
  message TEXT NULL,
  expires_at TIMESTAMPTZ NULL,
  disabled_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gift_cards_store_code_unique UNIQUE (store_id, code),
  CONSTRAINT gift_cards_store_hash_unique UNIQUE (store_id, code_hash),
  CONSTRAINT gift_cards_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT gift_cards_initial_balance_check CHECK (initial_balance > 0),
  CONSTRAINT gift_cards_current_balance_check CHECK (current_balance >= 0 AND current_balance <= initial_balance),
  CONSTRAINT gift_cards_status_check CHECK (status IN ('ACTIVE', 'DISABLED', 'DEPLETED', 'EXPIRED'))
);

CREATE INDEX IF NOT EXISTS gift_cards_store_status_idx
  ON gift_cards (store_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS gift_cards_store_customer_idx
  ON gift_cards (store_id, customer_id);

CREATE INDEX IF NOT EXISTS gift_cards_store_hash_lookup_idx
  ON gift_cards (store_id, code_hash);

-- ---------------------------------------------------------------------------
-- 2. Gift Card Transactions (Append-Only Financial Ledger)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  gift_card_id UUID NOT NULL REFERENCES gift_cards (id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  amount BIGINT NOT NULL,
  balance_before BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  checkout_id UUID NULL REFERENCES checkouts (id) ON DELETE SET NULL,
  order_id UUID NULL REFERENCES orders (id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gift_card_tx_store_card_idem_unique UNIQUE (store_id, gift_card_id, idempotency_key),
  CONSTRAINT gift_card_tx_type_check CHECK (type IN ('ISSUANCE', 'REDEMPTION', 'REFUND', 'EXPIRATION', 'ADJUSTMENT')),
  CONSTRAINT gift_card_tx_balances_check CHECK (balance_before >= 0 AND balance_after >= 0)
);

CREATE INDEX IF NOT EXISTS gift_card_tx_store_card_idx
  ON gift_card_transactions (store_id, gift_card_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Customer Store Credits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_credits (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  current_balance BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT store_credits_store_customer_curr_unique UNIQUE (store_id, customer_id, currency),
  CONSTRAINT store_credits_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT store_credits_current_balance_check CHECK (current_balance >= 0)
);

CREATE INDEX IF NOT EXISTS store_credits_store_customer_idx
  ON store_credits (store_id, customer_id);

-- ---------------------------------------------------------------------------
-- 4. Store Credit Transactions (Append-Only Financial Ledger)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_credit_transactions (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  store_credit_id UUID NOT NULL REFERENCES store_credits (id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  amount BIGINT NOT NULL,
  balance_before BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  order_id UUID NULL REFERENCES orders (id) ON DELETE SET NULL,
  checkout_id UUID NULL REFERENCES checkouts (id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT store_credit_tx_store_credit_idem_unique UNIQUE (store_id, store_credit_id, idempotency_key),
  CONSTRAINT store_credit_tx_type_check CHECK (type IN ('ISSUANCE', 'REDEMPTION', 'REFUND', 'ADJUSTMENT')),
  CONSTRAINT store_credit_tx_balances_check CHECK (balance_before >= 0 AND balance_after >= 0)
);

CREATE INDEX IF NOT EXISTS store_credit_tx_store_credit_idx
  ON store_credit_transactions (store_id, store_credit_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Checkout Applied Gift Cards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkout_gift_cards (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  checkout_id UUID NOT NULL REFERENCES checkouts (id) ON DELETE CASCADE,
  gift_card_id UUID NOT NULL REFERENCES gift_cards (id) ON DELETE CASCADE,
  applied_amount BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT checkout_gift_cards_checkout_card_unique UNIQUE (checkout_id, gift_card_id),
  CONSTRAINT checkout_gift_cards_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT checkout_gift_cards_applied_amount_check CHECK (applied_amount > 0)
);

CREATE INDEX IF NOT EXISTS checkout_gift_cards_store_checkout_idx
  ON checkout_gift_cards (store_id, checkout_id);

-- ---------------------------------------------------------------------------
-- 6. Order Redeemed Gift Cards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_gift_cards (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  gift_card_id UUID NOT NULL REFERENCES gift_cards (id) ON DELETE CASCADE,
  code_last4 VARCHAR(4) NOT NULL,
  amount BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_gift_cards_order_card_unique UNIQUE (order_id, gift_card_id),
  CONSTRAINT order_gift_cards_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT order_gift_cards_amount_check CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS order_gift_cards_store_order_idx
  ON order_gift_cards (store_id, order_id);
