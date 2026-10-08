-- Migration 0005: Add unique index for inventory adjustments by store and reference
-- Prevents duplicate stock adjustment recordings under concurrency or retry

DROP INDEX IF EXISTS inventory_adjustments_reference_idx;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_adjustments_store_reference_unique
  ON inventory_adjustments (store_id, reference_type, reference_id)
  WHERE reference_id IS NOT NULL;
