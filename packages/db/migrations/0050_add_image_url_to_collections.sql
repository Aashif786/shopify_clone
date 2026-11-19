-- Migration: 0050_add_image_url_to_collections.sql
-- Description: Adds image_url column to collections table for collection banner/thumbnail images.

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS image_url TEXT;
