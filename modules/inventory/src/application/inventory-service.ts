import type { Database, DatabaseClient } from "@calcart/db";
import { generateUuidV7, NotificationOutboxRepository } from "@calcart/db";
import type {
  InventoryAdjustment,
  InventoryItem,
  InventoryReservation,
} from "../domain/entities.js";
import {
  CrossStoreInventoryAccessError,
  DuplicateReservationError,
  InsufficientStockError,
  InventoryNotFoundError,
  ReservationNotFoundError,
} from "../domain/errors.js";
import {
  assertValidReservationTransition,
} from "../domain/lifecycle.js";
import {
  calculateTotalQuantity,
  validateAdjustmentReason,
  validatePositiveQuantity,
  validateQuantityDelta,
  validateReference,
} from "../domain/validation.js";
import { InventoryRepository } from "../infrastructure/inventory-repository.js";
import type {
  AdjustInventoryInput,
  InventoryAdjustmentDTO,
  InventoryAvailabilityDTO,
  InventoryItemDTO,
  InventoryReservationDTO,
  ReserveInventoryInput,
  ReserveManyInventoryInput,
  StoreInventoryItemDTO,
  ListStoreInventoryFilter,
} from "./dtos.js";

function isDatabase(client: Database | DatabaseClient): client is Database {
  return "withTransaction" in client;
}

async function runInTransaction<T>(
  clientOrDb: Database | DatabaseClient,
  fn: (tx: DatabaseClient) => Promise<T>,
): Promise<T> {
  if (isDatabase(clientOrDb)) {
    return clientOrDb.withTransaction(fn);
  }
  return fn(clientOrDb);
}

function toItemDTO(item: InventoryItem): InventoryItemDTO {
  return {
    id: item.id,
    storeId: item.storeId,
    variantId: item.variantId,
    availableQuantity: item.availableQuantity,
    reservedQuantity: item.reservedQuantity,
    totalQuantity: calculateTotalQuantity(
      item.availableQuantity,
      item.reservedQuantity,
    ),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toReservationDTO(res: InventoryReservation): InventoryReservationDTO {
  return {
    id: res.id,
    storeId: res.storeId,
    inventoryItemId: res.inventoryItemId,
    referenceType: res.referenceType,
    referenceId: res.referenceId,
    quantity: res.quantity,
    status: res.status,
    expiresAt: res.expiresAt.toISOString(),
    createdAt: res.createdAt.toISOString(),
    updatedAt: res.updatedAt.toISOString(),
  };
}

function toAdjustmentDTO(adj: InventoryAdjustment): InventoryAdjustmentDTO {
  return {
    id: adj.id,
    storeId: adj.storeId,
    inventoryItemId: adj.inventoryItemId,
    quantityDelta: adj.quantityDelta,
    previousQuantity: adj.previousQuantity,
    newQuantity: adj.newQuantity,
    reason: adj.reason,
    referenceType: adj.referenceType,
    referenceId: adj.referenceId,
    createdBy: adj.createdBy,
    createdAt: adj.createdAt.toISOString(),
  };
}

export class InventoryService {
  constructor(
    private readonly repository: InventoryRepository = new InventoryRepository(),
    private readonly outboxRepo: NotificationOutboxRepository = new NotificationOutboxRepository(),
  ) {}

  private async checkAndQueueLowStockAlert(
    tx: DatabaseClient,
    storeId: string,
    variantId: string,
    previousQuantity: number,
    newQuantity: number,
  ): Promise<void> {
    if (newQuantity >= previousQuantity) return;
    try {
      const metaRes = await tx.query<{
        product_title: string;
        variant_title: string | null;
        sku: string | null;
        low_stock_threshold: number;
        merchant_email: string | null;
        store_name: string;
        store_slug: string;
      }>(
        `SELECT
           p.title AS product_title,
           pv.title AS variant_title,
           pv.sku AS sku,
           COALESCE(pv.low_stock_threshold, p.low_stock_threshold, 5) AS low_stock_threshold,
           s.name AS store_name,
           s.slug AS store_slug,
           (
             SELECT u.email
             FROM store_memberships sm
             JOIN users u ON u.id = sm.user_id
             WHERE sm.store_id = s.id AND sm.role IN ('owner', 'admin')
             ORDER BY CASE WHEN sm.role = 'owner' THEN 1 ELSE 2 END ASC
             LIMIT 1
           ) AS merchant_email
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id AND p.store_id = pv.store_id
         JOIN stores s ON s.id = p.store_id
         WHERE pv.id = $1 AND pv.store_id = $2
         LIMIT 1`,
        [variantId, storeId],
      );

      const row = metaRes.rows[0];
      if (!row) return;

      const threshold = row.low_stock_threshold;
      const crossedThreshold = previousQuantity > threshold && newQuantity <= threshold;
      const hitZero = previousQuantity > 0 && newQuantity === 0;

      if (!crossedThreshold && !hitZero) return;

      const isOutOfStock = newQuantity <= 0;
      const idempotencyKey = `low_stock:${storeId}:${variantId}:${newQuantity}`;

      const payload = {
        storeId,
        storeName: row.store_name,
        storeSlug: row.store_slug,
        variantId,
        productTitle: row.product_title,
        variantTitle: row.variant_title,
        sku: row.sku,
        availableQuantity: newQuantity,
        lowStockThreshold: threshold,
        isOutOfStock,
        recipientEmail: row.merchant_email,
      };

      await this.outboxRepo.create(tx, {
        storeId,
        notificationType: "LOW_STOCK_ALERT",
        recipientEmail: row.merchant_email,
        referenceType: "inventory",
        referenceId: variantId,
        idempotencyKey,
        payload,
      });
    } catch (err) {
      // Fail-open: notification failure should never block inventory mutation
      console.error("[InventoryService] Failed to queue low stock alert:", err);
    }
  }

  async getAvailability(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    variantId: string,
  ): Promise<InventoryAvailabilityDTO> {
    const item = await this.repository.findItemByVariantId(
      clientOrDb,
      storeId,
      variantId,
    );
    if (!item) {
      return {
        variantId,
        availableQuantity: 0,
        reservedQuantity: 0,
        totalQuantity: 0,
        isAvailable: false,
      };
    }

    const total = calculateTotalQuantity(
      item.availableQuantity,
      item.reservedQuantity,
    );
    return {
      variantId,
      availableQuantity: item.availableQuantity,
      reservedQuantity: item.reservedQuantity,
      totalQuantity: total,
      isAvailable: item.availableQuantity > 0,
    };
  }

  async getBatchAvailability(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    variantIds: string[],
  ): Promise<Map<string, InventoryAvailabilityDTO>> {
    const result = new Map<string, InventoryAvailabilityDTO>();
    if (variantIds.length === 0) {
      return result;
    }

    const uniqueIds = Array.from(new Set(variantIds));
    const items = await this.repository.findItemsByVariantIds(
      clientOrDb,
      storeId,
      uniqueIds,
    );

    const itemMap = new Map<string, (typeof items)[0]>();
    for (const item of items) {
      itemMap.set(item.variantId, item);
    }

    for (const vid of uniqueIds) {
      const item = itemMap.get(vid);
      if (!item) {
        result.set(vid, {
          variantId: vid,
          availableQuantity: 0,
          reservedQuantity: 0,
          totalQuantity: 0,
          isAvailable: false,
        });
      } else {
        const total = calculateTotalQuantity(
          item.availableQuantity,
          item.reservedQuantity,
        );
        result.set(vid, {
          variantId: vid,
          availableQuantity: item.availableQuantity,
          reservedQuantity: item.reservedQuantity,
          totalQuantity: total,
          isAvailable: item.availableQuantity > 0,
        });
      }
    }

    return result;
  }

  async getInventoryItem(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    variantId: string,
  ): Promise<InventoryItemDTO> {
    const item = await this.repository.findItemByVariantId(
      clientOrDb,
      storeId,
      variantId,
    );
    if (!item) {
      throw new InventoryNotFoundError(
        `Inventory item for variant '${variantId}' not found in store '${storeId}'`,
        { storeId, variantId },
      );
    }
    return toItemDTO(item);
  }

  async getInventoryById(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<InventoryItemDTO> {
    const item = await this.repository.findItemById(clientOrDb, storeId, id);
    if (!item) {
      throw new InventoryNotFoundError(
        `Inventory item '${id}' not found in store '${storeId}'`,
        { storeId, id },
      );
    }
    return toItemDTO(item);
  }

  async adjustStock(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    variantId: string,
    input: AdjustInventoryInput,
  ): Promise<{ item: InventoryItemDTO; adjustment: InventoryAdjustmentDTO }> {
    const delta = validateQuantityDelta(input.quantityDelta);
    const reason = validateAdjustmentReason(input.reason);
    const referenceType = input.referenceType
      ? validateReference(input.referenceType, "Reference type")
      : null;
    const referenceId = input.referenceId
      ? validateReference(input.referenceId, "Reference ID")
      : null;

    return runInTransaction(clientOrDb, async (tx) => {
      // 1. Initial idempotency check if reference is provided
      if (referenceType && referenceId) {
        const existingAdj = await this.repository.findAdjustmentByReference(
          tx,
          storeId,
          referenceType,
          referenceId,
        );
        if (existingAdj) {
          if (
            existingAdj.quantityDelta === delta &&
            existingAdj.reason === reason
          ) {
            const currentItem = await this.repository.findItemById(
              tx,
              storeId,
              existingAdj.inventoryItemId,
            );
            if (currentItem) {
              return {
                item: toItemDTO(currentItem),
                adjustment: toAdjustmentDTO(existingAdj),
              };
            }
          }
          throw new DuplicateReservationError(
            `Adjustment reference '${referenceId}' has already been processed with different parameters`,
          );
        }
      }

      // 2. Lock inventory row FOR UPDATE
      let item = await this.repository.findItemByVariantIdForUpdate(
        tx,
        storeId,
        variantId,
      );

      // 3. If item does not exist, verify variant and initialize lazily
      if (!item) {
        const variantExists = await this.repository.variantExistsInStore(
          tx,
          storeId,
          variantId,
        );
        if (!variantExists) {
          throw new CrossStoreInventoryAccessError(
            `Variant '${variantId}' does not belong to store '${storeId}' or does not exist`,
          );
        }

        if (delta < 0) {
          throw new InsufficientStockError(
            "Cannot apply negative stock adjustment to uninitialized inventory",
            { delta, storeId, variantId },
          );
        }

        const newItemId = generateUuidV7();
        const insertedItem = await this.repository.insertItem(tx, {
          id: newItemId,
          storeId,
          variantId,
          availableQuantity: delta,
          reservedQuantity: 0,
        });

        if (!insertedItem) {
          // A concurrent transaction inserted the item first!
          // Re-fetch under FOR UPDATE lock so we serialize cleanly behind it.
          item = await this.repository.findItemByVariantIdForUpdate(
            tx,
            storeId,
            variantId,
          );
          if (!item) {
            throw new InventoryNotFoundError(
              `Failed to lock inventory item for variant '${variantId}'`,
              { storeId, variantId },
            );
          }
        } else {
          item = insertedItem;
          const adj = await this.repository.insertAdjustment(tx, {
            id: generateUuidV7(),
            storeId,
            inventoryItemId: item.id,
            quantityDelta: delta,
            previousQuantity: 0,
            newQuantity: delta,
            reason,
            referenceType,
            referenceId,
            createdBy: input.createdBy ?? null,
          });

          return { item: toItemDTO(item), adjustment: toAdjustmentDTO(adj) };
        }
      }

      // Re-check idempotency under row lock (double-checked locking)
      if (referenceType && referenceId) {
        const existingAdj = await this.repository.findAdjustmentByReference(
          tx,
          storeId,
          referenceType,
          referenceId,
        );
        if (existingAdj) {
          if (
            existingAdj.quantityDelta === delta &&
            existingAdj.reason === reason &&
            existingAdj.inventoryItemId === item.id
          ) {
            return {
              item: toItemDTO(item),
              adjustment: toAdjustmentDTO(existingAdj),
            };
          }
          throw new DuplicateReservationError(
            `Adjustment reference '${referenceId}' has already been processed with different parameters`,
          );
        }
      }

      // 4. Existing inventory: calculate new quantity
      const previousQuantity = item.availableQuantity;
      const newQuantity = previousQuantity + delta;

      if (newQuantity < 0) {
        throw new InsufficientStockError(
          `Adjustment of ${delta} would reduce available quantity (${previousQuantity}) below zero`,
          { previousQuantity, delta, newQuantity },
        );
      }

      const updatedItem = await this.repository.updateItemQuantities(
        tx,
        storeId,
        item.id,
        newQuantity,
        item.reservedQuantity,
      );

      await this.checkAndQueueLowStockAlert(
        tx,
        storeId,
        variantId,
        previousQuantity,
        newQuantity,
      );

      const adjustment = await this.repository.insertAdjustment(tx, {
        id: generateUuidV7(),
        storeId,
        inventoryItemId: item.id,
        quantityDelta: delta,
        previousQuantity,
        newQuantity,
        reason,
        referenceType,
        referenceId,
        createdBy: input.createdBy ?? null,
      });

      return {
        item: toItemDTO(updatedItem),
        adjustment: toAdjustmentDTO(adjustment),
      };
    });
  }

  async reserve(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    input: ReserveInventoryInput,
  ): Promise<InventoryReservationDTO> {
    const qty = validatePositiveQuantity(input.quantity);
    const refType = validateReference(input.referenceType, "Reference type");
    const refId = validateReference(input.referenceId, "Reference ID");
    const expiresAt =
      input.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000); // 15 min default

    return runInTransaction(clientOrDb, async (tx) => {
      // 1. Lock inventory item FOR UPDATE
      const item = await this.repository.findItemByVariantIdForUpdate(
        tx,
        storeId,
        input.variantId,
      );

      if (!item) {
        const variantExists = await this.repository.variantExistsInStore(
          tx,
          storeId,
          input.variantId,
        );
        if (!variantExists) {
          throw new CrossStoreInventoryAccessError(
            `Variant '${input.variantId}' does not belong to store '${storeId}' or does not exist`,
          );
        }
        throw new InsufficientStockError(
          `No inventory available for variant '${input.variantId}'`,
          { requested: qty, available: 0 },
        );
      }

      // 2. Check idempotency for this item + reference
      const existingRes = await this.repository.findReservationByReference(
        tx,
        storeId,
        item.id,
        refType,
        refId,
      );

      if (existingRes) {
        if (existingRes.quantity === qty && existingRes.status === "ACTIVE") {
          return toReservationDTO(existingRes);
        }
        throw new DuplicateReservationError(
          `Reservation conflict: reference '${refId}' already exists with status '${existingRes.status}' and quantity ${existingRes.quantity}`,
        );
      }

      // 3. Verify available stock
      if (item.availableQuantity < qty) {
        throw new InsufficientStockError(
          `Insufficient stock: requested ${qty}, available ${item.availableQuantity}`,
          { requested: qty, available: item.availableQuantity },
        );
      }

      // 4. Atomically mutate stock
      const newAvailable = item.availableQuantity - qty;
      const newReserved = item.reservedQuantity + qty;

      await this.repository.updateItemQuantities(
        tx,
        storeId,
        item.id,
        newAvailable,
        newReserved,
      );

      await this.checkAndQueueLowStockAlert(
        tx,
        storeId,
        input.variantId,
        item.availableQuantity,
        newAvailable,
      );

      // 5. Create reservation record
      const reservation = await this.repository.insertReservation(tx, {
        id: generateUuidV7(),
        storeId,
        inventoryItemId: item.id,
        referenceType: refType,
        referenceId: refId,
        quantity: qty,
        status: "ACTIVE",
        expiresAt,
      });

      return toReservationDTO(reservation);
    });
  }

  async reserveMany(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    input: ReserveManyInventoryInput,
  ): Promise<InventoryReservationDTO[]> {
    if (input.items.length === 0) {
      return [];
    }

    const refType = validateReference(input.referenceType, "Reference type");
    const refId = validateReference(input.referenceId, "Reference ID");
    const expiresAt =
      input.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000);

    for (const it of input.items) {
      validatePositiveQuantity(it.quantity);
    }

    // Consolidate demanded quantities by variantId to handle duplicate variants correctly
    const demandedQuantities = new Map<string, number>();
    for (const item of input.items) {
      demandedQuantities.set(
        item.variantId,
        (demandedQuantities.get(item.variantId) ?? 0) + item.quantity,
      );
    }

    return runInTransaction(clientOrDb, async (tx) => {
      // Deterministic lock order: sort unique variant IDs ascending
      const sortedVariantIds = Array.from(demandedQuantities.keys()).sort(
        (a, b) => a.localeCompare(b),
      );

      // Lock all required inventory rows deterministically
      const lockedItems =
        await this.repository.findItemsByVariantIdsForUpdate(
          tx,
          storeId,
          sortedVariantIds,
        );

      const itemMap = new Map(lockedItems.map((item) => [item.variantId, item]));

      // Verify all variants belong to the store and have sufficient stock
      for (const [variantId, totalRequested] of demandedQuantities.entries()) {
        const inv = itemMap.get(variantId);
        if (!inv) {
          const variantExists = await this.repository.variantExistsInStore(
            tx,
            storeId,
            variantId,
          );
          if (!variantExists) {
            throw new CrossStoreInventoryAccessError(
              `Variant '${variantId}' does not belong to store '${storeId}' or does not exist`,
            );
          }
          throw new InsufficientStockError(
            `No inventory available for variant '${variantId}' in store '${storeId}'`,
            { variantId, requested: totalRequested, available: 0 },
          );
        }

        // Check if existing reservation already satisfies this demand
        const existing = await this.repository.findReservationByReference(
          tx,
          storeId,
          inv.id,
          refType,
          refId,
        );

        if (existing) {
          if (
            existing.quantity === totalRequested &&
            existing.status === "ACTIVE"
          ) {
            continue;
          }
          throw new DuplicateReservationError(
            `Reservation conflict for item '${inv.id}' and reference '${refId}': existing status '${existing.status}', quantity ${existing.quantity}`,
          );
        }

        if (inv.availableQuantity < totalRequested) {
          throw new InsufficientStockError(
            `Insufficient stock for variant '${variantId}': requested ${totalRequested}, available ${inv.availableQuantity}`,
            {
              variantId,
              requested: totalRequested,
              available: inv.availableQuantity,
            },
          );
        }
      }

      // Check idempotency across all items and apply mutations
      const results: InventoryReservationDTO[] = [];

      for (const [variantId, totalRequested] of demandedQuantities.entries()) {
        const inv = itemMap.get(variantId)!;

        const existing = await this.repository.findReservationByReference(
          tx,
          storeId,
          inv.id,
          refType,
          refId,
        );

        if (existing) {
          results.push(toReservationDTO(existing));
          continue;
        }

        const newAvail = inv.availableQuantity - totalRequested;
        const newRes = inv.reservedQuantity + totalRequested;

        await this.repository.updateItemQuantities(
          tx,
          storeId,
          inv.id,
          newAvail,
          newRes,
        );

        await this.checkAndQueueLowStockAlert(
          tx,
          storeId,
          variantId,
          inv.availableQuantity,
          newAvail,
        );

        const resRecord = await this.repository.insertReservation(tx, {
          id: generateUuidV7(),
          storeId,
          inventoryItemId: inv.id,
          referenceType: refType,
          referenceId: refId,
          quantity: totalRequested,
          status: "ACTIVE",
          expiresAt,
        });

        results.push(toReservationDTO(resRecord));
      }

      return results;
    });
  }

  async releaseReservation(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    reservationId: string,
  ): Promise<InventoryReservationDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      // 1. Lock reservation row FOR UPDATE
      const res = await this.repository.findReservationByIdForUpdate(
        tx,
        storeId,
        reservationId,
      );

      if (!res) {
        throw new ReservationNotFoundError(
          `Reservation '${reservationId}' not found in store '${storeId}'`,
          { storeId, reservationId },
        );
      }

      // 2. Safe idempotent release: already released returns existing record
      if (res.status === "RELEASED") {
        return toReservationDTO(res);
      }

      assertValidReservationTransition(res.status, "RELEASED");

      // 3. Lock corresponding inventory item row
      const item = await this.repository.findItemByIdForUpdate(
        tx,
        storeId,
        res.inventoryItemId,
      );

      if (!item) {
        throw new InventoryNotFoundError(
          `Inventory item '${res.inventoryItemId}' not found for reservation '${reservationId}'`,
        );
      }

      // 4. Restore stock
      const newAvail = item.availableQuantity + res.quantity;
      const newReserved = Math.max(0, item.reservedQuantity - res.quantity);

      await this.repository.updateItemQuantities(
        tx,
        storeId,
        item.id,
        newAvail,
        newReserved,
      );

      // 5. Transition reservation status
      const updatedRes = await this.repository.updateReservationStatus(
        tx,
        storeId,
        res.id,
        "RELEASED",
      );

      return toReservationDTO(updatedRes);
    });
  }

  async finalizeReservation(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    reservationId: string,
  ): Promise<InventoryReservationDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      // 1. Lock reservation row FOR UPDATE
      const res = await this.repository.findReservationByIdForUpdate(
        tx,
        storeId,
        reservationId,
      );

      if (!res) {
        throw new ReservationNotFoundError(
          `Reservation '${reservationId}' not found in store '${storeId}'`,
          { storeId, reservationId },
        );
      }

      // 2. Safe idempotent finalization: already committed returns existing record
      if (res.status === "COMMITTED") {
        return toReservationDTO(res);
      }

      assertValidReservationTransition(res.status, "COMMITTED");

      // 3. Lock corresponding inventory item row
      const item = await this.repository.findItemByIdForUpdate(
        tx,
        storeId,
        res.inventoryItemId,
      );

      if (!item) {
        throw new InventoryNotFoundError(
          `Inventory item '${res.inventoryItemId}' not found for reservation '${reservationId}'`,
        );
      }

      // 4. Consume reserved stock (available was already reduced at reservation time)
      const newReserved = Math.max(0, item.reservedQuantity - res.quantity);

      await this.repository.updateItemQuantities(
        tx,
        storeId,
        item.id,
        item.availableQuantity,
        newReserved,
      );

      // 5. Transition reservation status
      const updatedRes = await this.repository.updateReservationStatus(
        tx,
        storeId,
        res.id,
        "COMMITTED",
      );

      return toReservationDTO(updatedRes);
    });
  }

  async expireReservations(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    asOfDate = new Date(),
  ): Promise<{ expiredCount: number; released: InventoryReservationDTO[] }> {
    return runInTransaction(clientOrDb, async (tx) => {
      const expiredIds =
        await this.repository.findExpiredActiveReservationIds(
          tx,
          storeId,
          asOfDate,
        );

      const released: InventoryReservationDTO[] = [];

      for (const id of expiredIds) {
        // Lock reservation row to verify it is still ACTIVE before releasing
        const res = await this.repository.findReservationByIdForUpdate(
          tx,
          storeId,
          id,
        );
        if (!res || res.status !== "ACTIVE") {
          // Already finalized or released by concurrent transaction: skip safely
          continue;
        }

        const releasedRes = await this.releaseReservation(tx, storeId, id);
        released.push(releasedRes);
      }

      return {
        expiredCount: released.length,
        released,
      };
    });
  }

  async expireAllExpiredReservations(
    clientOrDb: Database | DatabaseClient,
    options?: { asOfDate?: Date; limit?: number },
  ): Promise<{
    expiredCount: number;
    failedCount: number;
    released: InventoryReservationDTO[];
  }> {
    const asOfDate = options?.asOfDate ?? new Date();
    const limit = Math.max(1, Math.min(options?.limit ?? 50, 500));

    const candidates = await this.repository.findExpiredActiveReservations(
      clientOrDb,
      asOfDate,
      limit,
    );

    const released: InventoryReservationDTO[] = [];
    let failedCount = 0;

    for (const candidate of candidates) {
      try {
        await runInTransaction(clientOrDb, async (tx) => {
          // Lock reservation row to verify it is still ACTIVE before releasing
          const res = await this.repository.findReservationByIdForUpdate(
            tx,
            candidate.storeId,
            candidate.id,
          );

          if (!res || res.status !== "ACTIVE" || res.expiresAt > asOfDate) {
            // Already finalized, released, or extended by concurrent transaction: skip safely
            return;
          }

          const releasedRes = await this.releaseReservation(
            tx,
            candidate.storeId,
            candidate.id,
          );
          released.push(releasedRes);
        });
      } catch (err) {
        failedCount++;
        console.error(
          `[InventoryService] Failed to release expired reservation '${candidate.id}' for store '${candidate.storeId}':`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return {
      expiredCount: released.length,
      failedCount,
      released,
    };
  }

  async getReservation(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    reservationId: string,
  ): Promise<InventoryReservationDTO> {
    const res = await this.repository.findReservationById(
      clientOrDb,
      storeId,
      reservationId,
    );
    if (!res) {
      throw new ReservationNotFoundError(
        `Reservation '${reservationId}' not found in store '${storeId}'`,
        { storeId, reservationId },
      );
    }
    return toReservationDTO(res);
  }

  async listAdjustments(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    variantId: string,
    limit = 50,
  ): Promise<InventoryAdjustmentDTO[]> {
    const item = await this.repository.findItemByVariantId(
      clientOrDb,
      storeId,
      variantId,
    );
    if (!item) {
      return [];
    }
    const adjustments = await this.repository.listAdjustments(
      clientOrDb,
      storeId,
      item.id,
      limit,
    );
    return adjustments.map(toAdjustmentDTO);
  }

  async listStoreInventory(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    filter: ListStoreInventoryFilter = {},
  ): Promise<StoreInventoryItemDTO[]> {
    if (!storeId || typeof storeId !== "string" || storeId.trim().length === 0) {
      throw new CrossStoreInventoryAccessError("storeId is required to list store inventory");
    }

    return this.repository.listStoreInventory(clientOrDb, storeId, filter);
  }
}

