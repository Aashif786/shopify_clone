import type { Database, DatabaseClient } from "@shopify-clone/db";
import type { InventoryReservation } from "../domain/entities.js";
import {
  InventoryNotFoundError,
  ReservationNotFoundError,
  CrossStoreInventoryAccessError,
} from "../domain/errors.js";
import { assertValidReservationTransition } from "../domain/lifecycle.js";
import { InventoryRepository } from "../infrastructure/inventory-repository.js";
import type { InventoryReservationDTO } from "./dtos.js";

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

export interface ReleaseOrderReservationsInput {
  storeId: string;
  orderId?: string;
  checkoutId?: string;
}

export interface ReleaseOrderReservationsResult {
  releasedCount: number;
  skippedCount: number;
  reservations: InventoryReservationDTO[];
}

export class ReservationReleaseService {
  constructor(
    private readonly repository: InventoryRepository = new InventoryRepository(),
  ) {}

  async releaseOrderReservations(
    clientOrDb: Database | DatabaseClient,
    input: ReleaseOrderReservationsInput,
  ): Promise<ReleaseOrderReservationsResult> {
    const { storeId, orderId, checkoutId } = input;

    if (!storeId || typeof storeId !== "string" || storeId.trim().length === 0) {
      throw new Error("storeId is required to release order reservations");
    }

    const references: Array<{ referenceType: string; referenceId: string }> = [];
    if (orderId && typeof orderId === "string" && orderId.trim().length > 0) {
      references.push({ referenceType: "order", referenceId: orderId.trim() });
    }
    if (checkoutId && typeof checkoutId === "string" && checkoutId.trim().length > 0) {
      references.push({ referenceType: "checkout", referenceId: checkoutId.trim() });
    }

    if (references.length === 0) {
      return { releasedCount: 0, skippedCount: 0, reservations: [] };
    }

    return runInTransaction(clientOrDb, async (tx) => {
      // 1. Fetch matching reservations FOR UPDATE ordered by ID to avoid deadlocks
      const reservations = await this.repository.findReservationsByReferencesForUpdate(
        tx,
        storeId,
        references,
      );

      let releasedCount = 0;
      let skippedCount = 0;
      const resultReservations: InventoryReservationDTO[] = [];

      for (const res of reservations) {
        // Safe idempotent release: already released rows are no-ops
        if (res.status === "RELEASED") {
          skippedCount++;
          resultReservations.push(toReservationDTO(res));
          continue;
        }

        // If committed, stock was consumed and cannot be released as reservation
        if (res.status === "COMMITTED") {
          skippedCount++;
          resultReservations.push(toReservationDTO(res));
          continue;
        }

        // Validate transition
        assertValidReservationTransition(res.status, "RELEASED");

        // Lock inventory item row FOR UPDATE
        const item = await this.repository.findItemByIdForUpdate(
          tx,
          storeId,
          res.inventoryItemId,
        );

        if (!item) {
          throw new InventoryNotFoundError(
            `Inventory item '${res.inventoryItemId}' not found for reservation '${res.id}'`,
          );
        }

        // Restore available stock and decrement reserved stock
        const newAvailable = item.availableQuantity + res.quantity;
        const newReserved = Math.max(0, item.reservedQuantity - res.quantity);

        await this.repository.updateItemQuantities(
          tx,
          storeId,
          item.id,
          newAvailable,
          newReserved,
        );

        // Update reservation status to RELEASED
        const updatedRes = await this.repository.updateReservationStatus(
          tx,
          storeId,
          res.id,
          "RELEASED",
        );

        releasedCount++;
        resultReservations.push(toReservationDTO(updatedRes));
      }

      return {
        releasedCount,
        skippedCount,
        reservations: resultReservations,
      };
    });
  }

  async releaseReservationById(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    reservationId: string,
  ): Promise<InventoryReservationDTO> {
    if (!storeId || typeof storeId !== "string" || storeId.trim().length === 0) {
      throw new Error("storeId is required");
    }
    if (!reservationId || typeof reservationId !== "string" || reservationId.trim().length === 0) {
      throw new Error("reservationId is required");
    }

    return runInTransaction(clientOrDb, async (tx) => {
      const res = await this.repository.findReservationByIdForUpdate(
        tx,
        storeId,
        reservationId,
      );

      if (!res) {
        const anyStoreRes = await tx.query<{ store_id: string }>(
          `SELECT store_id FROM inventory_reservations WHERE id = $1`,
          [reservationId],
        );
        if (anyStoreRes.rows[0]) {
          throw new CrossStoreInventoryAccessError(
            `Reservation '${reservationId}' does not belong to store '${storeId}'`,
          );
        }
        throw new ReservationNotFoundError(
          `Reservation '${reservationId}' not found in store '${storeId}'`,
          { storeId, reservationId },
        );
      }

      if (res.status === "RELEASED") {
        return toReservationDTO(res);
      }

      assertValidReservationTransition(res.status, "RELEASED");

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

      const newAvailable = item.availableQuantity + res.quantity;
      const newReserved = Math.max(0, item.reservedQuantity - res.quantity);

      await this.repository.updateItemQuantities(
        tx,
        storeId,
        item.id,
        newAvailable,
        newReserved,
      );

      const updatedRes = await this.repository.updateReservationStatus(
        tx,
        storeId,
        res.id,
        "RELEASED",
      );

      return toReservationDTO(updatedRes);
    });
  }
}
