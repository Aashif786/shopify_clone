import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { StoreService } from "@shopify-clone/stores";
import { ProductService } from "@shopify-clone/products";
import {
  CrossStoreInventoryAccessError,
  DuplicateReservationError,
  InsufficientStockError,
  InvalidReservationStateTransitionError,
  InventoryService,
  ReservationNotFoundError,
} from "@shopify-clone/inventory";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Inventory Application Service Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const storeService = new StoreService();
  const productService = new ProductService();
  const inventoryService = new InventoryService();

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function setupDb(): Promise<Database> {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    return isolated.database;
  }

  async function createTestUser(db: Database, email = "merchant@example.com") {
    const userId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Merchant', 'scrypt:hash', 'ACTIVE')`,
      [userId, email],
    );
    return userId;
  }

  async function createTestStore(db: Database, userId: string, slug = "store-inv") {
    return await storeService.createStore(db, userId, {
      name: "Inventory Store",
      slug,
      currency: "USD",
      locale: "en-US",
      timezone: "America/New_York",
    });
  }

  async function createTestProduct(db: Database, storeId: string, slug = "shirt") {
    return await productService.createProduct(db, storeId, {
      title: "Oxford Cotton Shirt",
      slug,
      price: 4500,
    });
  }

  describe("Stock Adjustments (adjustStock)", () => {
    it("lazily initializes inventory and records adjustment on first stock receipt", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId, "store-adj-1");
      const product = await createTestProduct(db, store.id, "shirt-1");
      const variantId = product.variants[0]!.id;

      const result = await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: 50,
        reason: "INITIAL_STOCK",
      });

      expect(result.item.availableQuantity).toBe(50);
      expect(result.item.reservedQuantity).toBe(0);
      expect(result.item.totalQuantity).toBe(50);
      expect(result.adjustment.previousQuantity).toBe(0);
      expect(result.adjustment.newQuantity).toBe(50);
      expect(result.adjustment.quantityDelta).toBe(50);
      expect(result.adjustment.reason).toBe("INITIAL_STOCK");

      // Verify availability
      const avail = await inventoryService.getAvailability(db, store.id, variantId);
      expect(avail.availableQuantity).toBe(50);
      expect(avail.isAvailable).toBe(true);
    });

    it("applies subsequent positive and negative adjustments safely", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId, "store-adj-2");
      const product = await createTestProduct(db, store.id, "shirt-2");
      const variantId = product.variants[0]!.id;

      await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: 20,
        reason: "INITIAL_STOCK",
      });

      // +10 restock
      const restocked = await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: 10,
        reason: "RESTOCK",
      });
      expect(restocked.item.availableQuantity).toBe(30);
      expect(restocked.adjustment.previousQuantity).toBe(20);
      expect(restocked.adjustment.newQuantity).toBe(30);

      // -5 damaged
      const damaged = await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: -5,
        reason: "DAMAGED",
      });
      expect(damaged.item.availableQuantity).toBe(25);
      expect(damaged.adjustment.previousQuantity).toBe(30);
      expect(damaged.adjustment.newQuantity).toBe(25);

      // Audit history
      const history = await inventoryService.listAdjustments(db, store.id, variantId);
      expect(history).toHaveLength(3);
    });

    it("rejects adjustment that would reduce stock below zero", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId, "store-adj-3");
      const product = await createTestProduct(db, store.id, "shirt-3");
      const variantId = product.variants[0]!.id;

      await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: 10,
        reason: "INITIAL_STOCK",
      });

      await expect(
        inventoryService.adjustStock(db, store.id, variantId, {
          quantityDelta: -15,
          reason: "DAMAGED",
        }),
      ).rejects.toThrow(InsufficientStockError);

      const item = await inventoryService.getInventoryItem(db, store.id, variantId);
      expect(item.availableQuantity).toBe(10);
    });

    it("handles idempotent adjustment retries and detects conflicts", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId, "store-adj-idem");
      const product = await createTestProduct(db, store.id, "shirt-idem");
      const variantId = product.variants[0]!.id;

      const first = await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: 10,
        reason: "RESTOCK",
        referenceType: "PURCHASE_ORDER",
        referenceId: "PO-1001",
      });

      // Same request retry: returns existing result without modifying stock again
      const retry = await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: 10,
        reason: "RESTOCK",
        referenceType: "PURCHASE_ORDER",
        referenceId: "PO-1001",
      });

      expect(retry.adjustment.id).toBe(first.adjustment.id);
      expect(retry.item.availableQuantity).toBe(10);

      // Same reference with different parameters throws conflict error
      await expect(
        inventoryService.adjustStock(db, store.id, variantId, {
          quantityDelta: 20,
          reason: "RESTOCK",
          referenceType: "PURCHASE_ORDER",
          referenceId: "PO-1001",
        }),
      ).rejects.toThrow(DuplicateReservationError);
    });
  });

  describe("Inventory Reservations (reserve)", () => {
    it("atomically allocates available stock to reserved stock", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId, "store-res-1");
      const product = await createTestProduct(db, store.id, "shirt-res-1");
      const variantId = product.variants[0]!.id;

      await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: 10,
        reason: "INITIAL_STOCK",
      });

      const reservation = await inventoryService.reserve(db, store.id, {
        variantId,
        quantity: 4,
        referenceType: "CHECKOUT",
        referenceId: "chk_001",
      });

      expect(reservation.quantity).toBe(4);
      expect(reservation.status).toBe("ACTIVE");

      const item = await inventoryService.getInventoryItem(db, store.id, variantId);
      expect(item.availableQuantity).toBe(6);
      expect(item.reservedQuantity).toBe(4);
      expect(item.totalQuantity).toBe(10);
    });

    it("rejects reservation when available quantity is insufficient", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId, "store-res-2");
      const product = await createTestProduct(db, store.id, "shirt-res-2");
      const variantId = product.variants[0]!.id;

      await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: 5,
        reason: "INITIAL_STOCK",
      });

      await expect(
        inventoryService.reserve(db, store.id, {
          variantId,
          quantity: 6,
          referenceType: "CHECKOUT",
          referenceId: "chk_over",
        }),
      ).rejects.toThrow(InsufficientStockError);

      const item = await inventoryService.getInventoryItem(db, store.id, variantId);
      expect(item.availableQuantity).toBe(5);
      expect(item.reservedQuantity).toBe(0);
    });

    it("handles idempotent reservation retries and conflicts", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId, "store-res-idem");
      const product = await createTestProduct(db, store.id, "shirt-res-idem");
      const variantId = product.variants[0]!.id;

      await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: 10,
        reason: "INITIAL_STOCK",
      });

      const first = await inventoryService.reserve(db, store.id, {
        variantId,
        quantity: 3,
        referenceType: "CHECKOUT",
        referenceId: "chk_idem_1",
      });

      // Identical retry returns existing reservation
      const retry = await inventoryService.reserve(db, store.id, {
        variantId,
        quantity: 3,
        referenceType: "CHECKOUT",
        referenceId: "chk_idem_1",
      });

      expect(retry.id).toBe(first.id);

      const item = await inventoryService.getInventoryItem(db, store.id, variantId);
      expect(item.availableQuantity).toBe(7);
      expect(item.reservedQuantity).toBe(3);

      // Reused reference with different quantity triggers conflict
      await expect(
        inventoryService.reserve(db, store.id, {
          variantId,
          quantity: 5,
          referenceType: "CHECKOUT",
          referenceId: "chk_idem_1",
        }),
      ).rejects.toThrow(DuplicateReservationError);
    });
  });

  describe("Multi-variant Atomic Reservations (reserveMany)", () => {
    it("atomically reserves multiple variants in deterministic order", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId, "store-multi");
      const p1 = await createTestProduct(db, store.id, "item-1");
      const p2 = await createTestProduct(db, store.id, "item-2");
      const v1 = p1.variants[0]!.id;
      const v2 = p2.variants[0]!.id;

      await inventoryService.adjustStock(db, store.id, v1, {
        quantityDelta: 10,
        reason: "INITIAL_STOCK",
      });
      await inventoryService.adjustStock(db, store.id, v2, {
        quantityDelta: 20,
        reason: "INITIAL_STOCK",
      });

      const res = await inventoryService.reserveMany(db, store.id, {
        items: [
          { variantId: v2, quantity: 5 },
          { variantId: v1, quantity: 2 },
        ],
        referenceType: "CHECKOUT",
        referenceId: "chk_multi_ok",
      });

      expect(res).toHaveLength(2);

      const item1 = await inventoryService.getInventoryItem(db, store.id, v1);
      const item2 = await inventoryService.getInventoryItem(db, store.id, v2);
      expect(item1.availableQuantity).toBe(8);
      expect(item1.reservedQuantity).toBe(2);
      expect(item2.availableQuantity).toBe(15);
      expect(item2.reservedQuantity).toBe(5);
    });

    it("atomically rolls back all items if any variant has insufficient stock", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId, "store-multi-fail");
      const p1 = await createTestProduct(db, store.id, "item-a");
      const p2 = await createTestProduct(db, store.id, "item-b");
      const v1 = p1.variants[0]!.id;
      const v2 = p2.variants[0]!.id;

      await inventoryService.adjustStock(db, store.id, v1, {
        quantityDelta: 10,
        reason: "INITIAL_STOCK",
      });
      await inventoryService.adjustStock(db, store.id, v2, {
        quantityDelta: 2,
        reason: "INITIAL_STOCK",
      });

      // Request 5 of v1 (available: 10) and 5 of v2 (available: 2 -> insufficient)
      await expect(
        inventoryService.reserveMany(db, store.id, {
          items: [
            { variantId: v1, quantity: 5 },
            { variantId: v2, quantity: 5 },
          ],
          referenceType: "CHECKOUT",
          referenceId: "chk_multi_fail",
        }),
      ).rejects.toThrow(InsufficientStockError);

      // Verify v1 was NOT partially reserved
      const item1 = await inventoryService.getInventoryItem(db, store.id, v1);
      const item2 = await inventoryService.getInventoryItem(db, store.id, v2);
      expect(item1.availableQuantity).toBe(10);
      expect(item1.reservedQuantity).toBe(0);
      expect(item2.availableQuantity).toBe(2);
      expect(item2.reservedQuantity).toBe(0);
    });
  });

  describe("Reservation Release and Finalization Lifecycle", () => {
    it("releases reservation and restores available stock safely", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId, "store-rel");
      const product = await createTestProduct(db, store.id, "item-rel");
      const variantId = product.variants[0]!.id;

      await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: 10,
        reason: "INITIAL_STOCK",
      });

      const res = await inventoryService.reserve(db, store.id, {
        variantId,
        quantity: 4,
        referenceType: "CHECKOUT",
        referenceId: "chk_rel",
      });

      const released = await inventoryService.releaseReservation(db, store.id, res.id);
      expect(released.status).toBe("RELEASED");

      const item = await inventoryService.getInventoryItem(db, store.id, variantId);
      expect(item.availableQuantity).toBe(10);
      expect(item.reservedQuantity).toBe(0);

      // Repeated release is an idempotent safe no-op
      const retryRel = await inventoryService.releaseReservation(db, store.id, res.id);
      expect(retryRel.status).toBe("RELEASED");
      const itemAfterRetry = await inventoryService.getInventoryItem(db, store.id, variantId);
      expect(itemAfterRetry.availableQuantity).toBe(10);
    });

    it("finalizes reservation and consumes reserved stock", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId, "store-fin");
      const product = await createTestProduct(db, store.id, "item-fin");
      const variantId = product.variants[0]!.id;

      await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: 10,
        reason: "INITIAL_STOCK",
      });

      const res = await inventoryService.reserve(db, store.id, {
        variantId,
        quantity: 4,
        referenceType: "CHECKOUT",
        referenceId: "chk_fin",
      });

      const finalized = await inventoryService.finalizeReservation(db, store.id, res.id);
      expect(finalized.status).toBe("COMMITTED");

      const item = await inventoryService.getInventoryItem(db, store.id, variantId);
      expect(item.availableQuantity).toBe(6);
      expect(item.reservedQuantity).toBe(0);
      expect(item.totalQuantity).toBe(6);

      // Repeated finalization is an idempotent safe no-op
      const retryFin = await inventoryService.finalizeReservation(db, store.id, res.id);
      expect(retryFin.status).toBe("COMMITTED");
      const itemAfterRetry = await inventoryService.getInventoryItem(db, store.id, variantId);
      expect(itemAfterRetry.reservedQuantity).toBe(0);
    });

    it("prevents illegal transition: release after finalize and finalize after release", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId, "store-illegal");
      const product = await createTestProduct(db, store.id, "item-illegal");
      const variantId = product.variants[0]!.id;

      await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: 10,
        reason: "INITIAL_STOCK",
      });

      const r1 = await inventoryService.reserve(db, store.id, {
        variantId,
        quantity: 2,
        referenceType: "CHECKOUT",
        referenceId: "chk_r1",
      });
      await inventoryService.finalizeReservation(db, store.id, r1.id);

      // Cannot release a COMMITTED reservation
      await expect(
        inventoryService.releaseReservation(db, store.id, r1.id),
      ).rejects.toThrow(InvalidReservationStateTransitionError);

      const r2 = await inventoryService.reserve(db, store.id, {
        variantId,
        quantity: 2,
        referenceType: "CHECKOUT",
        referenceId: "chk_r2",
      });
      await inventoryService.releaseReservation(db, store.id, r2.id);

      // Cannot finalize a RELEASED reservation
      await expect(
        inventoryService.finalizeReservation(db, store.id, r2.id),
      ).rejects.toThrow(InvalidReservationStateTransitionError);
    });

    it("expires only eligible active reservations and restores stock", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId, "store-exp");
      const product = await createTestProduct(db, store.id, "item-exp");
      const variantId = product.variants[0]!.id;

      await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: 10,
        reason: "INITIAL_STOCK",
      });

      // Reservation 1: expired 5 minutes ago
      const expiredDate = new Date(Date.now() - 5 * 60 * 1000);
      const r1 = await inventoryService.reserve(db, store.id, {
        variantId,
        quantity: 3,
        referenceType: "CHECKOUT",
        referenceId: "chk_exp_1",
        expiresAt: expiredDate,
      });

      // Reservation 2: expires 1 hour in future
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      const r2 = await inventoryService.reserve(db, store.id, {
        variantId,
        quantity: 2,
        referenceType: "CHECKOUT",
        referenceId: "chk_future_2",
        expiresAt: futureDate,
      });

      const itemBefore = await inventoryService.getInventoryItem(db, store.id, variantId);
      expect(itemBefore.availableQuantity).toBe(5);
      expect(itemBefore.reservedQuantity).toBe(5);

      const expResult = await inventoryService.expireReservations(db, store.id);
      expect(expResult.expiredCount).toBe(1);
      expect(expResult.released[0]!.id).toBe(r1.id);

      const itemAfter = await inventoryService.getInventoryItem(db, store.id, variantId);
      expect(itemAfter.availableQuantity).toBe(8); // +3 restored
      expect(itemAfter.reservedQuantity).toBe(2); // 2 remains reserved for r2

      const r2Check = await inventoryService.getReservation(db, store.id, r2.id);
      expect(r2Check.status).toBe("ACTIVE");
    });
  });

  describe("Tenant Isolation Boundary", () => {
    it("strictly prevents accessing or reserving variant inventory belonging to another store", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const storeA = await createTestStore(db, userId, "tenant-store-a");
      const storeB = await createTestStore(db, userId, "tenant-store-b");

      const productA = await createTestProduct(db, storeA.id, "item-store-a");
      const variantA = productA.variants[0]!.id;

      await inventoryService.adjustStock(db, storeA.id, variantA, {
        quantityDelta: 10,
        reason: "INITIAL_STOCK",
      });

      // Store B attempts to adjust Variant A's inventory
      await expect(
        inventoryService.adjustStock(db, storeB.id, variantA, {
          quantityDelta: 5,
          reason: "RESTOCK",
        }),
      ).rejects.toThrow(CrossStoreInventoryAccessError);

      // Store B attempts to reserve Variant A's inventory
      await expect(
        inventoryService.reserve(db, storeB.id, {
          variantId: variantA,
          quantity: 2,
          referenceType: "CHECKOUT",
          referenceId: "chk_cross",
        }),
      ).rejects.toThrow(CrossStoreInventoryAccessError);

      // Store B attempts to lookup Store A's reservation
      const resA = await inventoryService.reserve(db, storeA.id, {
        variantId: variantA,
        quantity: 2,
        referenceType: "CHECKOUT",
        referenceId: "chk_a",
      });

      await expect(
        inventoryService.getReservation(db, storeB.id, resA.id),
      ).rejects.toThrow(ReservationNotFoundError);

      await expect(
        inventoryService.releaseReservation(db, storeB.id, resA.id),
      ).rejects.toThrow(ReservationNotFoundError);
    });
  });

  describe("Rollback Integrity", () => {
    it("rolls back all changes when an error occurs during an inventory operation", async () => {
      const db = await setupDb();
      const userId = await createTestUser(db);
      const store = await createTestStore(db, userId, "store-rollback");
      const product = await createTestProduct(db, store.id, "item-rollback");
      const variantId = product.variants[0]!.id;

      await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: 10,
        reason: "INITIAL_STOCK",
      });

      // Execute transaction that fails after partial mutation
      await expect(
        db.withTransaction(async (tx) => {
          await inventoryService.reserve(tx, store.id, {
            variantId,
            quantity: 5,
            referenceType: "CHECKOUT",
            referenceId: "chk_roll",
          });
          throw new Error("Simulated downstream checkout failure");
        }),
      ).rejects.toThrow("Simulated downstream checkout failure");

      // Verify stock was restored to pre-transaction state
      const item = await inventoryService.getInventoryItem(db, store.id, variantId);
      expect(item.availableQuantity).toBe(10);
      expect(item.reservedQuantity).toBe(0);
    });
  });
});
