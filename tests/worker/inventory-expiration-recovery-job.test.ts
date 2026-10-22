import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import {
  InventoryExpirationRecoveryJob,
} from "../../apps/worker/src/jobs/inventory/inventory-expiration-recovery-job.js";
import { PaymentRecoveryScheduler } from "../../apps/worker/src/schedulers/payment-recovery-scheduler.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("InventoryExpirationRecoveryJob Integration Tests", { timeout: 35_000 }, () => {
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

  async function seedStoreWithInventory(
    db: Database,
    slug: string,
    initialAvailable = 10,
    initialReserved = 0,
  ): Promise<{ orgId: string; storeId: string; inventoryItemId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const inventoryItemId = generateUuidV7();

    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${slug}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, `Store ${slug}`, slug],
    );

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Test Product', $3, 'ACTIVE')`,
      [productId, storeId, `product-${Date.now().toString(36)}-${Math.random()}`],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Standard', $4, 5000, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId, `SKU-${Date.now().toString(36)}-${Math.random()}`],
    );

    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, $4, $5)`,
      [inventoryItemId, storeId, variantId, initialAvailable, initialReserved],
    );

    return { orgId, storeId, inventoryItemId };
  }

  it("reclaims expired active reservations across multiple stores and restores available stock", async () => {
    const db = await setupDb();
    const storeA = await seedStoreWithInventory(db, "store-a", 8, 2);
    const storeB = await seedStoreWithInventory(db, "store-b", 5, 5);

    const resA = generateUuidV7();
    const resB = generateUuidV7();

    // Expired 5 minutes ago
    await db.query(
      `INSERT INTO inventory_reservations (
         id, store_id, inventory_item_id, reference_type, reference_id,
         quantity, status, expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, 'checkout', $4, 2, 'ACTIVE', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes')`,
      [resA, storeA.storeId, storeA.inventoryItemId, generateUuidV7()],
    );

    // Expired 2 minutes ago
    await db.query(
      `INSERT INTO inventory_reservations (
         id, store_id, inventory_item_id, reference_type, reference_id,
         quantity, status, expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, 'checkout', $4, 5, 'ACTIVE', NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '17 minutes', NOW() - INTERVAL '17 minutes')`,
      [resB, storeB.storeId, storeB.inventoryItemId, generateUuidV7()],
    );

    const job = new InventoryExpirationRecoveryJob();
    const result = await job.run(db);

    expect(result.success).toBe(true);
    expect(result.recoveredCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.releasedReservationIds).toContain(resA);
    expect(result.releasedReservationIds).toContain(resB);

    // Verify reservation status in database
    const rowsResA = await db.query<{ status: string }>(
      `SELECT status FROM inventory_reservations WHERE id = $1`,
      [resA],
    );
    expect(rowsResA.rows[0]?.status).toBe("RELEASED");

    const rowsResB = await db.query<{ status: string }>(
      `SELECT status FROM inventory_reservations WHERE id = $1`,
      [resB],
    );
    expect(rowsResB.rows[0]?.status).toBe("RELEASED");

    // Verify stock restoration in Store A: available 8 + 2 = 10, reserved 2 - 2 = 0
    const itemA = await db.query<{ available_quantity: number; reserved_quantity: number }>(
      `SELECT available_quantity, reserved_quantity FROM inventory_items WHERE id = $1`,
      [storeA.inventoryItemId],
    );
    expect(itemA.rows[0]?.available_quantity).toBe(10);
    expect(itemA.rows[0]?.reserved_quantity).toBe(0);

    // Verify stock restoration in Store B: available 5 + 5 = 10, reserved 5 - 5 = 0
    const itemB = await db.query<{ available_quantity: number; reserved_quantity: number }>(
      `SELECT available_quantity, reserved_quantity FROM inventory_items WHERE id = $1`,
      [storeB.inventoryItemId],
    );
    expect(itemB.rows[0]?.available_quantity).toBe(10);
    expect(itemB.rows[0]?.reserved_quantity).toBe(0);
  });

  it("leaves active reservations in the future untouched", async () => {
    const db = await setupDb();
    const { storeId, inventoryItemId } = await seedStoreWithInventory(db, "store-future", 7, 3);
    const resId = generateUuidV7();

    // Expires in 15 minutes
    await db.query(
      `INSERT INTO inventory_reservations (
         id, store_id, inventory_item_id, reference_type, reference_id,
         quantity, status, expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, 'checkout', $4, 3, 'ACTIVE', NOW() + INTERVAL '15 minutes', NOW(), NOW())`,
      [resId, storeId, inventoryItemId, generateUuidV7()],
    );

    const job = new InventoryExpirationRecoveryJob();
    const result = await job.run(db);

    expect(result.success).toBe(true);
    expect(result.recoveredCount).toBe(0);

    const resRow = await db.query<{ status: string }>(
      `SELECT status FROM inventory_reservations WHERE id = $1`,
      [resId],
    );
    expect(resRow.rows[0]?.status).toBe("ACTIVE");

    const item = await db.query<{ available_quantity: number; reserved_quantity: number }>(
      `SELECT available_quantity, reserved_quantity FROM inventory_items WHERE id = $1`,
      [inventoryItemId],
    );
    expect(item.rows[0]?.available_quantity).toBe(7);
    expect(item.rows[0]?.reserved_quantity).toBe(3);
  });

  it("safely skips already COMMITTED and RELEASED reservations", async () => {
    const db = await setupDb();
    const { storeId, inventoryItemId } = await seedStoreWithInventory(db, "store-terminal", 10, 0);

    const committedResId = generateUuidV7();
    const releasedResId = generateUuidV7();

    await db.query(
      `INSERT INTO inventory_reservations (
         id, store_id, inventory_item_id, reference_type, reference_id,
         quantity, status, expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, 'order', $4, 2, 'COMMITTED', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '20 minutes')`,
      [committedResId, storeId, inventoryItemId, generateUuidV7()],
    );

    await db.query(
      `INSERT INTO inventory_reservations (
         id, store_id, inventory_item_id, reference_type, reference_id,
         quantity, status, expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, 'checkout', $4, 1, 'RELEASED', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '20 minutes')`,
      [releasedResId, storeId, inventoryItemId, generateUuidV7()],
    );

    const job = new InventoryExpirationRecoveryJob();
    const result = await job.run(db);

    expect(result.success).toBe(true);
    expect(result.recoveredCount).toBe(0);

    const cRow = await db.query<{ status: string }>(
      `SELECT status FROM inventory_reservations WHERE id = $1`,
      [committedResId],
    );
    expect(cRow.rows[0]?.status).toBe("COMMITTED");

    const rRow = await db.query<{ status: string }>(
      `SELECT status FROM inventory_reservations WHERE id = $1`,
      [releasedResId],
    );
    expect(rRow.rows[0]?.status).toBe("RELEASED");
  });

  it("is fully idempotent on subsequent runs without double-restoring stock", async () => {
    const db = await setupDb();
    const { storeId, inventoryItemId } = await seedStoreWithInventory(db, "store-idempotent", 5, 2);
    const resId = generateUuidV7();

    await db.query(
      `INSERT INTO inventory_reservations (
         id, store_id, inventory_item_id, reference_type, reference_id,
         quantity, status, expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, 'checkout', $4, 2, 'ACTIVE', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes')`,
      [resId, storeId, inventoryItemId, generateUuidV7()],
    );

    const job = new InventoryExpirationRecoveryJob();

    // First run recovers reservation
    const run1 = await job.run(db);
    expect(run1.success).toBe(true);
    expect(run1.recoveredCount).toBe(1);

    const itemAfter1 = await db.query<{ available_quantity: number; reserved_quantity: number }>(
      `SELECT available_quantity, reserved_quantity FROM inventory_items WHERE id = $1`,
      [inventoryItemId],
    );
    expect(itemAfter1.rows[0]?.available_quantity).toBe(7);
    expect(itemAfter1.rows[0]?.reserved_quantity).toBe(0);

    // Second run has nothing left to recover
    const run2 = await job.run(db);
    expect(run2.success).toBe(true);
    expect(run2.recoveredCount).toBe(0);

    const itemAfter2 = await db.query<{ available_quantity: number; reserved_quantity: number }>(
      `SELECT available_quantity, reserved_quantity FROM inventory_items WHERE id = $1`,
      [inventoryItemId],
    );
    expect(itemAfter2.rows[0]?.available_quantity).toBe(7);
    expect(itemAfter2.rows[0]?.reserved_quantity).toBe(0);
  });

  it("respects batch size configuration", async () => {
    const db = await setupDb();
    const { storeId, inventoryItemId } = await seedStoreWithInventory(db, "store-batch", 0, 5);

    for (let i = 0; i < 5; i++) {
      await db.query(
        `INSERT INTO inventory_reservations (
           id, store_id, inventory_item_id, reference_type, reference_id,
           quantity, status, expires_at, created_at, updated_at
         ) VALUES ($1, $2, $3, 'checkout', $4, 1, 'ACTIVE', NOW() - INTERVAL '${10 + i} minutes', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes')`,
        [generateUuidV7(), storeId, inventoryItemId, generateUuidV7()],
      );
    }

    const job = new InventoryExpirationRecoveryJob();

    // Batch size 2
    const batch1 = await job.run(db, { batchSize: 2 });
    expect(batch1.success).toBe(true);
    expect(batch1.recoveredCount).toBe(2);

    // 3 still active
    const activeRemaining = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM inventory_reservations WHERE store_id = $1 AND status = 'ACTIVE'`,
      [storeId],
    );
    expect(activeRemaining.rows[0]?.count).toBe("3");

    // Next batch with size 5 recovers remaining 3
    const batch2 = await job.run(db, { batchSize: 5 });
    expect(batch2.success).toBe(true);
    expect(batch2.recoveredCount).toBe(3);

    const activeFinal = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM inventory_reservations WHERE store_id = $1 AND status = 'ACTIVE'`,
      [storeId],
    );
    expect(activeFinal.rows[0]?.count).toBe("0");
  });

  it("executes cleanly within PaymentRecoveryScheduler cycle", async () => {
    const db = await setupDb();
    const { storeId, inventoryItemId } = await seedStoreWithInventory(db, "store-scheduler", 4, 1);
    const resId = generateUuidV7();

    await db.query(
      `INSERT INTO inventory_reservations (
         id, store_id, inventory_item_id, reference_type, reference_id,
         quantity, status, expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, 'checkout', $4, 1, 'ACTIVE', NOW() - INTERVAL '1 minute', NOW() - INTERVAL '16 minutes', NOW() - INTERVAL '16 minutes')`,
      [resId, storeId, inventoryItemId, generateUuidV7()],
    );

    const scheduler = new PaymentRecoveryScheduler(
      db,
      { enabled: true, pollIntervalMs: 10_000, batchSize: 50, leaseTimeoutMs: 60_000 },
      undefined,
      undefined,
      undefined,
      new InventoryExpirationRecoveryJob(),
    );

    const runResult = await scheduler.runNow();
    expect(runResult.inventoryExpiration).toBeDefined();
    expect(runResult.inventoryExpiration?.success).toBe(true);
    expect(runResult.inventoryExpiration?.recoveredCount).toBe(1);

    const item = await db.query<{ available_quantity: number; reserved_quantity: number }>(
      `SELECT available_quantity, reserved_quantity FROM inventory_items WHERE id = $1`,
      [inventoryItemId],
    );
    expect(item.rows[0]?.available_quantity).toBe(5);
    expect(item.rows[0]?.reserved_quantity).toBe(0);

    await scheduler.stop();
  });
});
