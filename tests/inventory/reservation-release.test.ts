import { afterEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@shopify-clone/db";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import {
  InventoryService,
  ReservationReleaseService,
  CrossStoreInventoryAccessError,
} from "../../modules/inventory/src/index.js";

describe("ReservationReleaseService Integration Tests", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;

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

  async function seedTestStore(
    db: Database,
    slug = "store-inv-release",
  ): Promise<{ orgId: string; storeId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${slug}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'INR', 'en-IN', 'Asia/Kolkata')`,
      [storeId, orgId, `Store ${slug}`, `${slug}-${Date.now()}`],
    );
    return { orgId, storeId };
  }

  async function seedInventoryItem(
    db: Database,
    storeId: string,
    initialAvailable = 10,
    initialReserved = 0,
  ): Promise<{ itemId: string; variantId: string }> {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const itemId = generateUuidV7();

    const slug = `product-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Test Product', $3, 'ACTIVE')`,
      [productId, storeId, slug],
    );

    await db.query(
      `INSERT INTO product_variants (id, store_id, product_id, title, price, sku)
       VALUES ($1, $2, $3, 'Default Variant', 500, $4)`,
      [variantId, storeId, productId, `SKU-${Date.now()}`],
    );

    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, $4, $5)`,
      [itemId, storeId, variantId, initialAvailable, initialReserved],
    );

    return { itemId, variantId };
  }

  it("releases active reservations for an order, restoring stock and updating status to RELEASED", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { variantId } = await seedInventoryItem(db, storeId, 10, 0);

    const invService = new InventoryService();
    const releaseService = new ReservationReleaseService();

    const orderId = generateUuidV7();

    // Reserve 4 units for the order
    const reservation = await invService.reserve(db, storeId, {
      variantId,
      quantity: 4,
      referenceType: "order",
      referenceId: orderId,
    });
    expect(reservation.status).toBe("ACTIVE");
    expect(reservation.quantity).toBe(4);

    // Verify stock state: available = 6, reserved = 4
    const itemBefore = await invService.getInventoryItem(db, storeId, variantId);
    expect(itemBefore.availableQuantity).toBe(6);
    expect(itemBefore.reservedQuantity).toBe(4);

    // Release reservations for the order
    const releaseResult = await releaseService.releaseOrderReservations(db, {
      storeId,
      orderId,
    });

    expect(releaseResult.releasedCount).toBe(1);
    expect(releaseResult.skippedCount).toBe(0);
    expect(releaseResult.reservations).toHaveLength(1);
    expect(releaseResult.reservations[0]!.status).toBe("RELEASED");

    // Verify stock restored: available = 10, reserved = 0
    const itemAfter = await invService.getInventoryItem(db, storeId, variantId);
    expect(itemAfter.availableQuantity).toBe(10);
    expect(itemAfter.reservedQuantity).toBe(0);
  });

  it("handles repeated release requests idempotently without double-restocking", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { variantId } = await seedInventoryItem(db, storeId, 10, 0);

    const invService = new InventoryService();
    const releaseService = new ReservationReleaseService();

    const orderId = generateUuidV7();

    await invService.reserve(db, storeId, {
      variantId,
      quantity: 3,
      referenceType: "order",
      referenceId: orderId,
    });

    // First release
    const res1 = await releaseService.releaseOrderReservations(db, {
      storeId,
      orderId,
    });
    expect(res1.releasedCount).toBe(1);
    expect(res1.skippedCount).toBe(0);

    // Second release (idempotent retry)
    const res2 = await releaseService.releaseOrderReservations(db, {
      storeId,
      orderId,
    });
    expect(res2.releasedCount).toBe(0);
    expect(res2.skippedCount).toBe(1);
    expect(res2.reservations[0]!.status).toBe("RELEASED");

    // Verify stock was restored only once (available = 10, reserved = 0)
    const item = await invService.getInventoryItem(db, storeId, variantId);
    expect(item.availableQuantity).toBe(10);
    expect(item.reservedQuantity).toBe(0);
  });

  it("safely handles concurrent release attempts restoring stock exactly once", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { variantId } = await seedInventoryItem(db, storeId, 10, 0);

    const invService = new InventoryService();
    const releaseService = new ReservationReleaseService();

    const orderId = generateUuidV7();

    await invService.reserve(db, storeId, {
      variantId,
      quantity: 5,
      referenceType: "order",
      referenceId: orderId,
    });

    // Race two release operations concurrently
    const [result1, result2] = await Promise.all([
      releaseService.releaseOrderReservations(db, { storeId, orderId }),
      releaseService.releaseOrderReservations(db, { storeId, orderId }),
    ]);

    const totalReleased = result1.releasedCount + result2.releasedCount;
    const totalSkipped = result1.skippedCount + result2.skippedCount;

    expect(totalReleased).toBe(1);
    expect(totalSkipped).toBe(1);

    const item = await invService.getInventoryItem(db, storeId, variantId);
    expect(item.availableQuantity).toBe(10);
    expect(item.reservedQuantity).toBe(0);
  });

  it("releases reservations matching either order ID or checkout ID", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const item1 = await seedInventoryItem(db, storeId, 10, 0);
    const item2 = await seedInventoryItem(db, storeId, 10, 0);

    const invService = new InventoryService();
    const releaseService = new ReservationReleaseService();

    const orderId = generateUuidV7();
    const checkoutId = generateUuidV7();

    // One reservation attached to checkout, one attached to order
    await invService.reserve(db, storeId, {
      variantId: item1.variantId,
      quantity: 2,
      referenceType: "checkout",
      referenceId: checkoutId,
    });

    await invService.reserve(db, storeId, {
      variantId: item2.variantId,
      quantity: 3,
      referenceType: "order",
      referenceId: orderId,
    });

    const result = await releaseService.releaseOrderReservations(db, {
      storeId,
      orderId,
      checkoutId,
    });

    expect(result.releasedCount).toBe(2);
    expect(result.skippedCount).toBe(0);

    const afterItem1 = await invService.getInventoryItem(db, storeId, item1.variantId);
    const afterItem2 = await invService.getInventoryItem(db, storeId, item2.variantId);
    expect(afterItem1.availableQuantity).toBe(10);
    expect(afterItem2.availableQuantity).toBe(10);
  });

  it("does not release reservations belonging to another tenant/store", async () => {
    const db = await setupDb();
    const storeA = await seedTestStore(db, "store-a");
    const storeB = await seedTestStore(db, "store-b");
    const itemA = await seedInventoryItem(db, storeA.storeId, 10, 0);

    const invService = new InventoryService();
    const releaseService = new ReservationReleaseService();

    const orderId = generateUuidV7();

    const reservation = await invService.reserve(db, storeA.storeId, {
      variantId: itemA.variantId,
      quantity: 2,
      referenceType: "order",
      referenceId: orderId,
    });

    // Store B attempts to release Store A's reservation by orderId
    const resultB = await releaseService.releaseOrderReservations(db, {
      storeId: storeB.storeId,
      orderId,
    });
    expect(resultB.releasedCount).toBe(0);
    expect(resultB.skippedCount).toBe(0);

    // Reservation in Store A remains active
    const checkRes = await invService.getReservation(db, storeA.storeId, reservation.id);
    expect(checkRes.status).toBe("ACTIVE");

    // Direct release by ID for wrong store throws CrossStoreInventoryAccessError
    await expect(
      releaseService.releaseReservationById(db, storeB.storeId, reservation.id),
    ).rejects.toThrow(CrossStoreInventoryAccessError);
  });

  it("handles orders with no reservations gracefully", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const releaseService = new ReservationReleaseService();

    const result = await releaseService.releaseOrderReservations(db, {
      storeId,
      orderId: generateUuidV7(),
    });

    expect(result.releasedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.reservations).toEqual([]);
  });
});
