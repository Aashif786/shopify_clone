import type { DatabaseClient } from "@shopify-clone/db";
import type {
  AdjustmentReason,
  InventoryAdjustment,
  InventoryItem,
  InventoryReservation,
  ReservationStatus,
} from "../domain/entities.js";

interface InventoryItemRow {
  id: string;
  store_id: string;
  variant_id: string;
  available_quantity: number;
  reserved_quantity: number;
  created_at: Date;
  updated_at: Date;
}

interface InventoryReservationRow {
  id: string;
  store_id: string;
  inventory_item_id: string;
  reference_type: string;
  reference_id: string;
  quantity: number;
  status: ReservationStatus;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

interface InventoryAdjustmentRow {
  id: string;
  store_id: string;
  inventory_item_id: string;
  quantity_delta: number;
  previous_quantity: number;
  new_quantity: number;
  reason: AdjustmentReason;
  reference_type: string | null;
  reference_id: string | null;
  created_by: string | null;
  created_at: Date;
}

function mapItemRow(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    storeId: row.store_id,
    variantId: row.variant_id,
    availableQuantity: row.available_quantity,
    reservedQuantity: row.reserved_quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReservationRow(row: InventoryReservationRow): InventoryReservation {
  return {
    id: row.id,
    storeId: row.store_id,
    inventoryItemId: row.inventory_item_id,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    quantity: row.quantity,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAdjustmentRow(row: InventoryAdjustmentRow): InventoryAdjustment {
  return {
    id: row.id,
    storeId: row.store_id,
    inventoryItemId: row.inventory_item_id,
    quantityDelta: row.quantity_delta,
    previousQuantity: row.previous_quantity,
    newQuantity: row.new_quantity,
    reason: row.reason,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export class InventoryRepository {
  async variantExistsInStore(
    client: DatabaseClient,
    storeId: string,
    variantId: string,
  ): Promise<boolean> {
    const res = await client.query<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM product_variants
        WHERE id = $1 AND store_id = $2
      ) as exists`,
      [variantId, storeId],
    );
    return Boolean(res.rows[0]?.exists);
  }

  async findItemByVariantId(
    client: DatabaseClient,
    storeId: string,
    variantId: string,
  ): Promise<InventoryItem | null> {
    const res = await client.query<InventoryItemRow>(
      `SELECT id, store_id, variant_id, available_quantity, reserved_quantity, created_at, updated_at
       FROM inventory_items
       WHERE store_id = $1 AND variant_id = $2`,
      [storeId, variantId],
    );
    const row = res.rows[0];
    return row ? mapItemRow(row) : null;
  }

  async findItemById(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<InventoryItem | null> {
    const res = await client.query<InventoryItemRow>(
      `SELECT id, store_id, variant_id, available_quantity, reserved_quantity, created_at, updated_at
       FROM inventory_items
       WHERE id = $1 AND store_id = $2`,
      [id, storeId],
    );
    const row = res.rows[0];
    return row ? mapItemRow(row) : null;
  }

  async findItemByVariantIdForUpdate(
    client: DatabaseClient,
    storeId: string,
    variantId: string,
  ): Promise<InventoryItem | null> {
    const res = await client.query<InventoryItemRow>(
      `SELECT id, store_id, variant_id, available_quantity, reserved_quantity, created_at, updated_at
       FROM inventory_items
       WHERE store_id = $1 AND variant_id = $2
       FOR UPDATE`,
      [storeId, variantId],
    );
    const row = res.rows[0];
    return row ? mapItemRow(row) : null;
  }

  async findItemByIdForUpdate(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<InventoryItem | null> {
    const res = await client.query<InventoryItemRow>(
      `SELECT id, store_id, variant_id, available_quantity, reserved_quantity, created_at, updated_at
       FROM inventory_items
       WHERE id = $1 AND store_id = $2
       FOR UPDATE`,
      [id, storeId],
    );
    const row = res.rows[0];
    return row ? mapItemRow(row) : null;
  }

  async findItemsByVariantIdsForUpdate(
    client: DatabaseClient,
    storeId: string,
    variantIds: string[],
  ): Promise<InventoryItem[]> {
    if (variantIds.length === 0) {
      return [];
    }
    const res = await client.query<InventoryItemRow>(
      `SELECT id, store_id, variant_id, available_quantity, reserved_quantity, created_at, updated_at
       FROM inventory_items
       WHERE store_id = $1 AND variant_id = ANY($2::uuid[])
       ORDER BY variant_id ASC
       FOR UPDATE`,
      [storeId, variantIds],
    );
    return res.rows.map(mapItemRow);
  }

  async insertItem(
    client: DatabaseClient,
    item: {
      id: string;
      storeId: string;
      variantId: string;
      availableQuantity: number;
      reservedQuantity: number;
    },
  ): Promise<InventoryItem | null> {
    const res = await client.query<InventoryItemRow>(
      `INSERT INTO inventory_items (
         id, store_id, variant_id, available_quantity, reserved_quantity, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (variant_id) DO NOTHING
       RETURNING id, store_id, variant_id, available_quantity, reserved_quantity, created_at, updated_at`,
      [
        item.id,
        item.storeId,
        item.variantId,
        item.availableQuantity,
        item.reservedQuantity,
      ],
    );
    const row = res.rows[0];
    return row ? mapItemRow(row) : null;
  }

  async updateItemQuantities(
    client: DatabaseClient,
    storeId: string,
    id: string,
    availableQuantity: number,
    reservedQuantity: number,
  ): Promise<InventoryItem> {
    const res = await client.query<InventoryItemRow>(
      `UPDATE inventory_items
       SET available_quantity = $1, reserved_quantity = $2, updated_at = NOW()
       WHERE id = $3 AND store_id = $4
       RETURNING id, store_id, variant_id, available_quantity, reserved_quantity, created_at, updated_at`,
      [availableQuantity, reservedQuantity, id, storeId],
    );
    return mapItemRow(res.rows[0]!);
  }

  async insertAdjustment(
    client: DatabaseClient,
    adj: {
      id: string;
      storeId: string;
      inventoryItemId: string;
      quantityDelta: number;
      previousQuantity: number;
      newQuantity: number;
      reason: AdjustmentReason;
      referenceType?: string | null;
      referenceId?: string | null;
      createdBy?: string | null;
    },
  ): Promise<InventoryAdjustment> {
    const res = await client.query<InventoryAdjustmentRow>(
      `INSERT INTO inventory_adjustments (
         id, store_id, inventory_item_id, quantity_delta, previous_quantity, new_quantity,
         reason, reference_type, reference_id, created_by, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING id, store_id, inventory_item_id, quantity_delta, previous_quantity, new_quantity,
                 reason, reference_type, reference_id, created_by, created_at`,
      [
        adj.id,
        adj.storeId,
        adj.inventoryItemId,
        adj.quantityDelta,
        adj.previousQuantity,
        adj.newQuantity,
        adj.reason,
        adj.referenceType ?? null,
        adj.referenceId ?? null,
        adj.createdBy ?? null,
      ],
    );
    return mapAdjustmentRow(res.rows[0]!);
  }

  async findAdjustmentByReference(
    client: DatabaseClient,
    storeId: string,
    referenceType: string,
    referenceId: string,
  ): Promise<InventoryAdjustment | null> {
    const res = await client.query<InventoryAdjustmentRow>(
      `SELECT id, store_id, inventory_item_id, quantity_delta, previous_quantity, new_quantity,
              reason, reference_type, reference_id, created_by, created_at
       FROM inventory_adjustments
       WHERE store_id = $1 AND reference_type = $2 AND reference_id = $3`,
      [storeId, referenceType, referenceId],
    );
    const row = res.rows[0];
    return row ? mapAdjustmentRow(row) : null;
  }

  async listAdjustments(
    client: DatabaseClient,
    storeId: string,
    inventoryItemId: string,
    limit = 50,
  ): Promise<InventoryAdjustment[]> {
    const res = await client.query<InventoryAdjustmentRow>(
      `SELECT id, store_id, inventory_item_id, quantity_delta, previous_quantity, new_quantity,
              reason, reference_type, reference_id, created_by, created_at
       FROM inventory_adjustments
       WHERE store_id = $1 AND inventory_item_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [storeId, inventoryItemId, limit],
    );
    return res.rows.map(mapAdjustmentRow);
  }

  async findReservationById(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<InventoryReservation | null> {
    const res = await client.query<InventoryReservationRow>(
      `SELECT id, store_id, inventory_item_id, reference_type, reference_id,
              quantity, status, expires_at, created_at, updated_at
       FROM inventory_reservations
       WHERE id = $1 AND store_id = $2`,
      [id, storeId],
    );
    const row = res.rows[0];
    return row ? mapReservationRow(row) : null;
  }

  async findReservationByIdForUpdate(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<InventoryReservation | null> {
    const res = await client.query<InventoryReservationRow>(
      `SELECT id, store_id, inventory_item_id, reference_type, reference_id,
              quantity, status, expires_at, created_at, updated_at
       FROM inventory_reservations
       WHERE id = $1 AND store_id = $2
       FOR UPDATE`,
      [id, storeId],
    );
    const row = res.rows[0];
    return row ? mapReservationRow(row) : null;
  }

  async findReservationByReference(
    client: DatabaseClient,
    storeId: string,
    inventoryItemId: string,
    referenceType: string,
    referenceId: string,
  ): Promise<InventoryReservation | null> {
    const res = await client.query<InventoryReservationRow>(
      `SELECT id, store_id, inventory_item_id, reference_type, reference_id,
              quantity, status, expires_at, created_at, updated_at
       FROM inventory_reservations
       WHERE store_id = $1 AND inventory_item_id = $2 AND reference_type = $3 AND reference_id = $4`,
      [storeId, inventoryItemId, referenceType, referenceId],
    );
    const row = res.rows[0];
    return row ? mapReservationRow(row) : null;
  }

  async insertReservation(
    client: DatabaseClient,
    res: {
      id: string;
      storeId: string;
      inventoryItemId: string;
      referenceType: string;
      referenceId: string;
      quantity: number;
      status: ReservationStatus;
      expiresAt: Date;
    },
  ): Promise<InventoryReservation> {
    const queryRes = await client.query<InventoryReservationRow>(
      `INSERT INTO inventory_reservations (
         id, store_id, inventory_item_id, reference_type, reference_id,
         quantity, status, expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id, store_id, inventory_item_id, reference_type, reference_id,
                 quantity, status, expires_at, created_at, updated_at`,
      [
        res.id,
        res.storeId,
        res.inventoryItemId,
        res.referenceType,
        res.referenceId,
        res.quantity,
        res.status,
        res.expiresAt,
      ],
    );
    return mapReservationRow(queryRes.rows[0]!);
  }

  async updateReservationStatus(
    client: DatabaseClient,
    storeId: string,
    id: string,
    status: ReservationStatus,
  ): Promise<InventoryReservation> {
    const res = await client.query<InventoryReservationRow>(
      `UPDATE inventory_reservations
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND store_id = $3
       RETURNING id, store_id, inventory_item_id, reference_type, reference_id,
                 quantity, status, expires_at, created_at, updated_at`,
      [status, id, storeId],
    );
    return mapReservationRow(res.rows[0]!);
  }

  async findExpiredActiveReservationIds(
    client: DatabaseClient,
    storeId: string,
    asOfDate: Date,
  ): Promise<string[]> {
    const res = await client.query<{ id: string }>(
      `SELECT id
       FROM inventory_reservations
       WHERE store_id = $1 AND status = 'ACTIVE' AND expires_at <= $2
       ORDER BY id ASC`,
      [storeId, asOfDate],
    );
    return res.rows.map((r) => r.id);
  }
}
