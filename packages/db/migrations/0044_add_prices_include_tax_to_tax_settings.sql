-- Migration: 0044_add_prices_include_tax_to_tax_settings.sql
-- Description: Adds prices_include_tax flag to tax_settings, checkout_tax_snapshots, and tax_invoices
--              to support Indian Maximum Retail Price (MRP) GST-inclusive pricing (GAP-11).

ALTER TABLE tax_settings
  ADD COLUMN IF NOT EXISTS prices_include_tax BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE checkout_tax_snapshots
  ADD COLUMN IF NOT EXISTS prices_include_tax BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tax_invoices
  ADD COLUMN IF NOT EXISTS prices_include_tax BOOLEAN NOT NULL DEFAULT FALSE;
