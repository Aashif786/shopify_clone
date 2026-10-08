-- Migration: 0004_create_inventory_schema.sql
-- Description: Creates inventory_items, inventory_reservations, and inventory_adjustments tables with constraints and indexes.

ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_id_store_id_unique UNIQUE (id, store_id);

CREATE TABLE inventory_items (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  variant_id UUID NOT NULL,
  available_quantity INT NOT NULL DEFAULT 0,
  reserved_quantity INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_items_variant_id_unique UNIQUE (variant_id),
  CONSTRAINT inventory_items_store_variant_unique UNIQUE (store_id, variant_id),
  CONSTRAINT inventory_items_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT inventory_items_variant_store_fkey FOREIGN KEY (variant_id, store_id)
    REFERENCES product_variants (id, store_id) ON DELETE RESTRICT,
  CONSTRAINT inventory_items_available_qty_check CHECK (available_quantity >= 0),
  CONSTRAINT inventory_items_reserved_qty_check CHECK (reserved_quantity >= 0)
);

CREATE INDEX inventory_items_store_id_idx ON inventory_items (store_id);
CREATE INDEX inventory_items_variant_id_idx ON inventory_items (variant_id);

CREATE TABLE inventory_reservations (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  inventory_item_id UUID NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  quantity INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_reservations_store_item_fkey FOREIGN KEY (inventory_item_id, store_id)
    REFERENCES inventory_items (id, store_id) ON DELETE RESTRICT,
  CONSTRAINT inventory_reservations_quantity_check CHECK (quantity > 0),
  CONSTRAINT inventory_reservations_status_check CHECK (status IN ('ACTIVE', 'RELEASED', 'COMMITTED')),
  CONSTRAINT inventory_reservations_item_ref_unique UNIQUE (inventory_item_id, reference_type, reference_id)
);

CREATE INDEX inventory_reservations_store_id_idx ON inventory_reservations (store_id);
CREATE INDEX inventory_reservations_item_id_idx ON inventory_reservations (inventory_item_id);
CREATE INDEX inventory_reservations_item_status_idx ON inventory_reservations (inventory_item_id, status);
CREATE INDEX inventory_reservations_expires_at_idx ON inventory_reservations (expires_at) WHERE status = 'ACTIVE';
CREATE INDEX inventory_reservations_reference_idx ON inventory_reservations (reference_type, reference_id);

CREATE TABLE inventory_adjustments (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  inventory_item_id UUID NOT NULL,
  quantity_delta INT NOT NULL,
  previous_quantity INT NOT NULL,
  new_quantity INT NOT NULL,
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_adjustments_store_item_fkey FOREIGN KEY (inventory_item_id, store_id)
    REFERENCES inventory_items (id, store_id) ON DELETE RESTRICT,
  CONSTRAINT inventory_adjustments_delta_check CHECK (quantity_delta <> 0),
  CONSTRAINT inventory_adjustments_prev_qty_check CHECK (previous_quantity >= 0),
  CONSTRAINT inventory_adjustments_new_qty_check CHECK (new_quantity >= 0),
  CONSTRAINT inventory_adjustments_math_check CHECK (new_quantity = previous_quantity + quantity_delta),
  CONSTRAINT inventory_adjustments_reason_check CHECK (reason IN (
    'INITIAL_STOCK',
    'RESTOCK',
    'MANUAL_CORRECTION',
    'DAMAGED',
    'LOST',
    'RETURNED',
    'OTHER'
  ))
);

CREATE INDEX inventory_adjustments_store_id_idx ON inventory_adjustments (store_id);
CREATE INDEX inventory_adjustments_item_id_idx ON inventory_adjustments (inventory_item_id);
CREATE INDEX inventory_adjustments_item_id_created_idx ON inventory_adjustments (inventory_item_id, created_at DESC);
CREATE INDEX inventory_adjustments_reference_idx ON inventory_adjustments (reference_type, reference_id) WHERE reference_id IS NOT NULL;
