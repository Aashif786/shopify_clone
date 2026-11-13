-- Migration: 0046_relax_gift_card_balance_check.sql
-- Description: Relax gift_cards_current_balance_check constraint to allow reloads,
--              balance adjustments, and multi-refund credits without exceeding ceiling.

ALTER TABLE gift_cards
  DROP CONSTRAINT IF EXISTS gift_cards_current_balance_check;

ALTER TABLE gift_cards
  ADD CONSTRAINT gift_cards_current_balance_check CHECK (current_balance >= 0);
