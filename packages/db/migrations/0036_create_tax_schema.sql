-- Migration: 0036_create_tax_schema.sql
-- Description: Creates the GST tax domain (GAP-11, milestone M5):
--              tax_settings            per-store seller registration (GSTIN, state, address)
--              product_tax_profiles    per-product HSN/SAC code and GST rate
--              checkout_tax_snapshots  frozen per-line CGST/SGST/IGST for each checkout
--              tax_invoice_sequences   gapless per-store, per-financial-year counter
--              tax_invoices            immutable GST tax invoices
--              tax_invoice_lines       immutable invoice line items
--
-- Tax is OFF by default: a store with no tax_settings row, or is_enabled = FALSE,
-- computes zero tax, so existing stores behave exactly as before this migration.
--
-- Tenant isolation: every table carries store_id and every reference to a row
-- owned by another module uses a composite (id, store_id) foreign key.
--
-- Monetary values are BIGINT minor units. Rates are integer basis points
-- (1800 = 18%), which keeps half-rates such as 0.25% and 2.5% exact.

-- ---------------------------------------------------------------------------
-- 1. Tax settings (seller registration)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_settings (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  legal_name TEXT,
  gstin TEXT,
  state_code TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postal_code TEXT,
  -- Applied to a product that has no product_tax_profiles row.
  default_gst_rate_bps INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tax_settings_store_id_unique UNIQUE (store_id),
  CONSTRAINT tax_settings_state_code_check CHECK (
    state_code IS NULL OR state_code ~ '^[0-9]{2}$'
  ),
  CONSTRAINT tax_settings_gstin_format_check CHECK (
    gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
  ),
  -- The first two GSTIN digits are the registration state code.
  CONSTRAINT tax_settings_gstin_state_match_check CHECK (
    gstin IS NULL OR state_code IS NULL OR substring(gstin FROM 1 FOR 2) = state_code
  ),
  CONSTRAINT tax_settings_default_rate_check CHECK (
    default_gst_rate_bps >= 0 AND default_gst_rate_bps <= 4000
  ),
  -- A store cannot switch tax on without the details an invoice legally needs.
  CONSTRAINT tax_settings_enabled_requires_registration_check CHECK (
    NOT is_enabled OR (
      legal_name IS NOT NULL AND char_length(btrim(legal_name)) > 0
      AND gstin IS NOT NULL
      AND state_code IS NOT NULL
      AND address_line1 IS NOT NULL AND char_length(btrim(address_line1)) > 0
      AND city IS NOT NULL AND char_length(btrim(city)) > 0
      AND postal_code IS NOT NULL AND char_length(btrim(postal_code)) > 0
    )
  )
);

-- ---------------------------------------------------------------------------
-- 2. Product tax profiles (HSN/SAC + GST rate)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_tax_profiles (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  hsn_code TEXT NOT NULL,
  gst_rate_bps INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_tax_profiles_product_unique UNIQUE (product_id),
  CONSTRAINT product_tax_profiles_product_store_fkey FOREIGN KEY (product_id, store_id)
    REFERENCES products (id, store_id) ON DELETE CASCADE,
  CONSTRAINT product_tax_profiles_hsn_check CHECK (hsn_code ~ '^[0-9]{4,8}$'),
  CONSTRAINT product_tax_profiles_rate_check CHECK (
    gst_rate_bps >= 0 AND gst_rate_bps <= 4000
  )
);

CREATE INDEX IF NOT EXISTS product_tax_profiles_store_idx
  ON product_tax_profiles (store_id);

-- ---------------------------------------------------------------------------
-- 3. Checkout tax snapshots
--    One row per checkout, upserted on every recalculation. The snapshot is
--    what the order and invoice are built from, so a later rate change can
--    never alter a checkout the customer has already been charged for.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkout_tax_snapshots (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  checkout_id UUID NOT NULL,
  supply_type TEXT NOT NULL,
  seller_state_code TEXT NOT NULL,
  place_of_supply_code TEXT,
  subtotal BIGINT NOT NULL,
  discount_total BIGINT NOT NULL,
  taxable_total BIGINT NOT NULL,
  cgst_total BIGINT NOT NULL DEFAULT 0,
  sgst_total BIGINT NOT NULL DEFAULT 0,
  igst_total BIGINT NOT NULL DEFAULT 0,
  tax_total BIGINT NOT NULL DEFAULT 0,
  lines JSONB NOT NULL,
  seller JSONB NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT checkout_tax_snapshots_checkout_unique UNIQUE (checkout_id),
  CONSTRAINT checkout_tax_snapshots_checkout_store_fkey FOREIGN KEY (checkout_id, store_id)
    REFERENCES checkouts (id, store_id) ON DELETE CASCADE,
  CONSTRAINT checkout_tax_snapshots_supply_type_check CHECK (
    supply_type IN ('INTRA_STATE', 'INTER_STATE', 'EXPORT')
  ),
  CONSTRAINT checkout_tax_snapshots_totals_check CHECK (
    subtotal >= 0 AND discount_total >= 0 AND taxable_total >= 0
    AND cgst_total >= 0 AND sgst_total >= 0 AND igst_total >= 0
    AND tax_total = cgst_total + sgst_total + igst_total
  ),
  -- CGST and SGST are always levied in equal halves.
  CONSTRAINT checkout_tax_snapshots_equal_halves_check CHECK (cgst_total = sgst_total),
  -- A supply is either intra-state (CGST+SGST) or inter-state (IGST), never both.
  CONSTRAINT checkout_tax_snapshots_split_check CHECK (
    (supply_type = 'INTRA_STATE' AND igst_total = 0)
    OR (supply_type = 'INTER_STATE' AND cgst_total = 0 AND sgst_total = 0)
    OR (supply_type = 'EXPORT' AND tax_total = 0)
  )
);

CREATE INDEX IF NOT EXISTS checkout_tax_snapshots_store_idx
  ON checkout_tax_snapshots (store_id);

-- ---------------------------------------------------------------------------
-- 4. Invoice number sequences (gapless per store per financial year)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_invoice_sequences (
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  financial_year TEXT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_id, financial_year),
  CONSTRAINT tax_invoice_sequences_fy_check CHECK (financial_year ~ '^[0-9]{4}$'),
  CONSTRAINT tax_invoice_sequences_number_check CHECK (last_number >= 0)
);

-- ---------------------------------------------------------------------------
-- 5. Tax invoices (immutable legal records)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_invoices (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  order_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  sequence_number INT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  currency TEXT NOT NULL,
  supply_type TEXT NOT NULL,
  place_of_supply_code TEXT,
  place_of_supply_name TEXT,
  seller JSONB NOT NULL,
  buyer JSONB NOT NULL,
  subtotal BIGINT NOT NULL,
  discount_total BIGINT NOT NULL,
  taxable_total BIGINT NOT NULL,
  cgst_total BIGINT NOT NULL DEFAULT 0,
  sgst_total BIGINT NOT NULL DEFAULT 0,
  igst_total BIGINT NOT NULL DEFAULT 0,
  tax_total BIGINT NOT NULL DEFAULT 0,
  shipping_total BIGINT NOT NULL DEFAULT 0,
  grand_total BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tax_invoices_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT tax_invoices_store_order_unique UNIQUE (store_id, order_id),
  CONSTRAINT tax_invoices_store_number_unique UNIQUE (store_id, invoice_number),
  CONSTRAINT tax_invoices_store_fy_sequence_unique UNIQUE (store_id, financial_year, sequence_number),
  CONSTRAINT tax_invoices_order_store_fkey FOREIGN KEY (order_id, store_id)
    REFERENCES orders (id, store_id) ON DELETE RESTRICT,
  CONSTRAINT tax_invoices_supply_type_check CHECK (
    supply_type IN ('INTRA_STATE', 'INTER_STATE', 'EXPORT')
  ),
  -- Rule 46 of the CGST Rules: at most 16 characters of letters, digits, '-' and '/'.
  CONSTRAINT tax_invoices_number_format_check CHECK (
    invoice_number ~ '^[A-Za-z0-9/-]{1,16}$'
  ),
  CONSTRAINT tax_invoices_totals_check CHECK (
    subtotal >= 0 AND discount_total >= 0 AND taxable_total >= 0
    AND tax_total = cgst_total + sgst_total + igst_total
    AND shipping_total >= 0 AND grand_total >= 0
  )
);

CREATE INDEX IF NOT EXISTS tax_invoices_store_issued_idx
  ON tax_invoices (store_id, issued_at DESC);

CREATE TABLE IF NOT EXISTS tax_invoice_lines (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  line_number INT NOT NULL,
  order_item_id UUID,
  description TEXT NOT NULL,
  hsn_code TEXT,
  quantity INT NOT NULL,
  unit_price BIGINT NOT NULL,
  discount BIGINT NOT NULL DEFAULT 0,
  taxable_value BIGINT NOT NULL,
  gst_rate_bps INT NOT NULL,
  cgst BIGINT NOT NULL DEFAULT 0,
  sgst BIGINT NOT NULL DEFAULT 0,
  igst BIGINT NOT NULL DEFAULT 0,
  line_total BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tax_invoice_lines_invoice_line_unique UNIQUE (invoice_id, line_number),
  CONSTRAINT tax_invoice_lines_invoice_store_fkey FOREIGN KEY (invoice_id, store_id)
    REFERENCES tax_invoices (id, store_id) ON DELETE RESTRICT,
  CONSTRAINT tax_invoice_lines_quantity_check CHECK (quantity > 0),
  CONSTRAINT tax_invoice_lines_amounts_check CHECK (
    unit_price >= 0 AND discount >= 0 AND taxable_value >= 0
    AND cgst >= 0 AND sgst >= 0 AND igst >= 0 AND line_total >= 0
  )
);

CREATE INDEX IF NOT EXISTS tax_invoice_lines_invoice_idx
  ON tax_invoice_lines (invoice_id);

-- Issued invoices are legal records: strictly append-only, never edited or
-- deleted. A correction is a credit note, which is a separate future document.
CREATE OR REPLACE FUNCTION prevent_tax_invoice_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Tax invoices are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_tax_invoice_mutation ON tax_invoices;
CREATE TRIGGER trg_prevent_tax_invoice_mutation
BEFORE UPDATE OR DELETE ON tax_invoices
FOR EACH ROW
EXECUTE FUNCTION prevent_tax_invoice_mutation();

DROP TRIGGER IF EXISTS trg_prevent_tax_invoice_line_mutation ON tax_invoice_lines;
CREATE TRIGGER trg_prevent_tax_invoice_line_mutation
BEFORE UPDATE OR DELETE ON tax_invoice_lines
FOR EACH ROW
EXECUTE FUNCTION prevent_tax_invoice_mutation();
