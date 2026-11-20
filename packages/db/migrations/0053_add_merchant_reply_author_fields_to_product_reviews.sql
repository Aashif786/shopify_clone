-- Migration: 0053_add_merchant_reply_author_fields_to_product_reviews.sql
-- Description: Adds customizable store reply author details to product_reviews:
--              merchant_reply_author_name (e.g. "Store Support", "Cal Cart Team", or staff name)
--              merchant_reply_author_avatar_url (uploaded logo, staff profile picture, or icon URL)

ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS merchant_reply_author_name TEXT,
  ADD COLUMN IF NOT EXISTS merchant_reply_author_avatar_url TEXT;
