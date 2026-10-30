import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { StoreService } from "@calcart/stores";
import { ProductService } from "@calcart/products";
import {
  InsufficientStockError,
  InventoryService,
} from "@calcart/inventory";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Inventory PostgreSQL Concurrency Tests", { timeout: 30_000 }, () => {
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

  async function createTestContext(
    db: Database,
    slug: string,
    initialStock = 10,
  ): Promise<{ storeId: string; variantId: string }> {
    const userId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Merchant', 'scrypt:hash', 'ACTIVE')`,
      [userId, `${slug}@example.com`],
    );

    const store = await storeService.createStore(db, userId, {
      name: `Store ${slug}`,
      slug,
      currency: "USD",
      locale: "en-US",
      timezone: "America/New_York",
    });

    const product = await productService.createProduct(db, store.id, {
      title: "Limited Edition Jacket",
      slug: `jacket-${slug}`,
      price: 12000,
    });
    const variantId = product.variants[0]!.id;

    if (initialStock > 0) {
      await inventoryService.adjustStock(db, store.id, variantId, {
        quantityDelta: initialStock,
        reason: "INITIAL_STOCK",
      });
    }

    return { storeId: store.id, variantId };
  }

  it("Test 1: Competing reservations (stock=10, A=7, B=7) -> exactly one succeeds, one fails", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "conc-compete", 10);

    // Launch two concurrent competing reservation requests
    const [resA, resB] = await Promise.allSettled([
      inventoryService.reserve(db, storeId, {
        variantId,
        quantity: 7,
        referenceType: "CHECKOUT",
        referenceId: "chk_compete_a",
      }),
      inventoryService.reserve(db, storeId, {
        variantId,
        quantity: 7,
        referenceType: "CHECKOUT",
        referenceId: "chk_compete_b",
      }),
    ]);

    const successes = [resA, resB].filter((r) => r.status === "fulfilled");
    const failures = [resA, resB].filter((r) => r.status === "rejected");

    // Exactly one must succeed and one must fail
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const failureReason = (failures[0] as PromiseRejectedResult).reason;
    expect(failureReason).toBeInstanceOf(InsufficientStockError);

    // Final database state must reflect exact numbers: available=3, reserved=7
    const item = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(item.availableQuantity).toBe(3);
    expect(item.reservedQuantity).toBe(7);
    expect(item.totalQuantity).toBe(10);
  });

  it("Test 2: Compatible reservations (stock=10, A=7, B=3) -> both succeed with serialized row locking", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "conc-compat", 10);

    // Launch two concurrent compatible reservation requests
    const [resA, resB] = await Promise.all([
      inventoryService.reserve(db, storeId, {
        variantId,
        quantity: 7,
        referenceType: "CHECKOUT",
        referenceId: "chk_compat_a",
      }),
      inventoryService.reserve(db, storeId, {
        variantId,
        quantity: 3,
        referenceType: "CHECKOUT",
        referenceId: "chk_compat_b",
      }),
    ]);

    expect(resA.quantity).toBe(7);
    expect(resB.quantity).toBe(3);

    // Final database state must be available=0, reserved=10
    const item = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(item.availableQuantity).toBe(0);
    expect(item.reservedQuantity).toBe(10);
    expect(item.totalQuantity).toBe(10);
  });

  it("Test 3: Concurrent adjustments without lost updates", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "conc-adj", 100);

    // 8 concurrent adjustments with various deltas:
    // +10, -5, +20, -15, +30, -10, +5, -5 (sum = +30)
    const deltas = [10, -5, 20, -15, 30, -10, 5, -5];
    const expectedFinal = 100 + deltas.reduce((a, b) => a + b, 0); // 130

    await Promise.all(
      deltas.map((delta, idx) =>
        inventoryService.adjustStock(db, storeId, variantId, {
          quantityDelta: delta,
          reason: delta > 0 ? "RESTOCK" : "DAMAGED",
          referenceType: "BATCH",
          referenceId: `batch_${idx}`,
        }),
      ),
    );

    const item = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(item.availableQuantity).toBe(expectedFinal);

    // Verify all history records exist (1 initial + 8 deltas = 9 records)
    const history = await inventoryService.listAdjustments(db, storeId, variantId, 100);
    expect(history).toHaveLength(9);
  });

  it("Test 4: Concurrent duplicate release -> quantity restored exactly once", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "conc-rel", 10);

    // Reserve 4 units (available: 6, reserved: 4)
    const reservation = await inventoryService.reserve(db, storeId, {
      variantId,
      quantity: 4,
      referenceType: "CHECKOUT",
      referenceId: "chk_conc_rel",
    });

    const itemBefore = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(itemBefore.availableQuantity).toBe(6);
    expect(itemBefore.reservedQuantity).toBe(4);

    // 5 concurrent attempts to release the exact same reservation
    const releaseResults = await Promise.all([
      inventoryService.releaseReservation(db, storeId, reservation.id),
      inventoryService.releaseReservation(db, storeId, reservation.id),
      inventoryService.releaseReservation(db, storeId, reservation.id),
      inventoryService.releaseReservation(db, storeId, reservation.id),
      inventoryService.releaseReservation(db, storeId, reservation.id),
    ]);

    for (const r of releaseResults) {
      expect(r.status).toBe("RELEASED");
    }

    // Crucial invariant: Stock must be restored exactly once (10 available, 0 reserved)
    // NOT 6 + (5 * 4) = 26
    const itemAfter = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(itemAfter.availableQuantity).toBe(10);
    expect(itemAfter.reservedQuantity).toBe(0);
    expect(itemAfter.totalQuantity).toBe(10);
  });

  it("Test 5: Concurrent duplicate finalization -> stock consumed exactly once", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "conc-fin", 10);

    // Reserve 4 units (available: 6, reserved: 4)
    const reservation = await inventoryService.reserve(db, storeId, {
      variantId,
      quantity: 4,
      referenceType: "CHECKOUT",
      referenceId: "chk_conc_fin",
    });

    // 5 concurrent attempts to finalize the exact same reservation
    const finalizeResults = await Promise.all([
      inventoryService.finalizeReservation(db, storeId, reservation.id),
      inventoryService.finalizeReservation(db, storeId, reservation.id),
      inventoryService.finalizeReservation(db, storeId, reservation.id),
      inventoryService.finalizeReservation(db, storeId, reservation.id),
      inventoryService.finalizeReservation(db, storeId, reservation.id),
    ]);

    for (const r of finalizeResults) {
      expect(r.status).toBe("COMMITTED");
    }

    // Crucial invariant: Reserved stock consumed exactly once (available: 6, reserved: 0, total: 6)
    // NOT negative reserved stock
    const itemAfter = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(itemAfter.availableQuantity).toBe(6);
    expect(itemAfter.reservedQuantity).toBe(0);
    expect(itemAfter.totalQuantity).toBe(6);
  });

  it("Test 6: High concurrency burst (stock=10, 8 concurrent requests for 2 units)", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await createTestContext(db, "conc-burst", 10);

    // 8 concurrent requests, each requesting 2 units (needs 16, but only 10 available)
    const requests = Array.from({ length: 8 }, (_, i) =>
      inventoryService.reserve(db, storeId, {
        variantId,
        quantity: 2,
        referenceType: "CHECKOUT",
        referenceId: `burst_${i}`,
      }),
    );

    const outcomes = await Promise.allSettled(requests);
    const succeeded = outcomes.filter((o) => o.status === "fulfilled");
    const failed = outcomes.filter((o) => o.status === "rejected");

    // Exactly 5 should succeed (5 * 2 = 10) and 3 should fail
    expect(succeeded).toHaveLength(5);
    expect(failed).toHaveLength(3);

    const finalItem = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(finalItem.availableQuantity).toBe(0);
    expect(finalItem.reservedQuantity).toBe(10);
    expect(finalItem.totalQuantity).toBe(10);
  });
});
