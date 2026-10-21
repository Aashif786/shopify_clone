-- Migration: 0013_add_guest_token_hash_to_checkouts_and_orders.sql
-- Description: Adds guest_token_hash column to checkouts and orders for server-verified guest ownership.

ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS guest_token_hash TEXT;
CREATE INDEX IF NOT EXISTS checkouts_guest_token_hash_idx ON checkouts (store_id, guest_token_hash) WHERE guest_token_hash IS NOT NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_token_hash TEXT;
CREATE INDEX IF NOT EXISTS orders_guest_token_hash_idx ON orders (store_id, guest_token_hash) WHERE guest_token_hash IS NOT NULL;
