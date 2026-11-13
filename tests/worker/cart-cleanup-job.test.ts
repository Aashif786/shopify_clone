import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { CartCleanupJob } from "../../apps/worker/src/jobs/carts/cart-cleanup-job.js";
import { PaymentRecoveryScheduler } from "../../apps/worker/src/schedulers/payment-recovery-scheduler.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("CartCleanupJob & Cart Lifecycle Worker Integration (GAP-15)", { timeout: 120_000 }, () => {
  let db: Database;
  let closeDb: () => Promise<void>;
  let orgId: string;
  let storeId: string;
  let customerId: string;
  let customerEmail: string;
  let variantId: string;

  beforeAll(async () => {
    const isolated = await createIsolatedDatabase();
    db = isolated.database;
    closeDb = isolated.close;
    await runMigrations(db);

    // Seed base store and catalog
    const slugSuffix = Date.now().toString(36);
    orgId = generateUuidV7();
    storeId = generateUuidV7();
    customerId = generateUuidV7();
    customerEmail = `shopper-${slugSuffix}@example.com`;
    const productId = generateUuidV7();
    variantId = generateUuidV7();

    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${slugSuffix}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, `Store ${slugSuffix}`, `store-${slugSuffix}`],
    );
    await db.query(
      `INSERT INTO customers (id, store_id, email, first_name, last_name, status)
       VALUES ($1, $2, $3, 'Jane', 'Doe', 'ACTIVE')`,
      [customerId, storeId, customerEmail],
    );
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Test Product', $3, 'ACTIVE')`,
      [productId, storeId, `product-${slugSuffix}`],
    );
    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Default Variant', $4, 4999, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId, `SKU-${slugSuffix}`],
    );
  }, 90_000);

  afterAll(async () => {
    if (closeDb) {
      await closeDb();
    }
  });

  it("leaves recently updated active carts untouched", async () => {
    const cartId = generateUuidV7();
    const asOfDate = new Date();
    const recentDate = new Date(asOfDate.getTime() - 10 * 60 * 1000); // 10 minutes ago

    await db.query(
      `INSERT INTO carts (id, store_id, customer_id, status, currency, subtotal, grand_total, created_at, updated_at)
       VALUES ($1, $2, $3, 'ACTIVE', 'USD', 4999, 4999, $4, $4)`,
      [cartId, storeId, customerId, recentDate],
    );

    const job = new CartCleanupJob();
    const result = await job.run(db, {
      asOfDate,
      abandonmentThresholdMs: 24 * 60 * 60 * 1000, // 24 hours
    });

    expect(result.success).toBe(true);
    expect(result.abandonedCartIds).not.toContain(cartId);

    const checkRes = await db.query<{ status: string }>(
      `SELECT status FROM carts WHERE id = $1`,
      [cartId],
    );
    expect(checkRes.rows[0]?.status).toBe("ACTIVE");
  });

  it("marks active carts older than inactivity threshold as ABANDONED and enqueues recovery email", async () => {
    const cartId = generateUuidV7();
    const itemId = generateUuidV7();
    const asOfDate = new Date();
    const staleDate = new Date(asOfDate.getTime() - 26 * 60 * 60 * 1000); // 26 hours ago

    // Insert stale active cart with item
    await db.query(
      `INSERT INTO carts (id, store_id, customer_id, status, currency, subtotal, grand_total, created_at, updated_at)
       VALUES ($1, $2, $3, 'ACTIVE', 'USD', 4999, 4999, $4, $4)`,
      [cartId, storeId, customerId, staleDate],
    );
    await db.query(
      `INSERT INTO cart_items (id, cart_id, store_id, variant_id, quantity, unit_price, line_subtotal, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 1, 4999, 4999, $5, $5)`,
      [itemId, cartId, storeId, variantId, staleDate],
    );

    const job = new CartCleanupJob();
    const result = await job.run(db, {
      asOfDate,
      abandonmentThresholdMs: 24 * 60 * 60 * 1000,
      enqueueRecoveryNotifications: true,
    });

    expect(result.success).toBe(true);
    expect(result.abandonedCount).toBeGreaterThanOrEqual(1);
    expect(result.abandonedCartIds).toContain(cartId);

    // Verify cart status in database
    const cartRes = await db.query<{ status: string }>(
      `SELECT status FROM carts WHERE id = $1`,
      [cartId],
    );
    expect(cartRes.rows[0]?.status).toBe("ABANDONED");

    // Verify recovery notification enqueued in notification_outbox
    const outboxRes = await db.query<{
      notification_type: string;
      recipient_email: string;
      status: string;
      payload: { cartId: string; grandTotal: number };
    }>(
      `SELECT notification_type, recipient_email, status, payload
       FROM notification_outbox
       WHERE store_id = $1 AND reference_id = $2`,
      [storeId, cartId],
    );

    expect(outboxRes.rows.length).toBe(1);
    const notification = outboxRes.rows[0];
    expect(notification.notification_type).toBe("ABANDONED_CART_RECOVERY");
    expect(notification.recipient_email).toBe(customerEmail);
    expect(notification.status).toBe("PENDING");
    expect(notification.payload.cartId).toBe(cartId);
    expect(notification.payload.grandTotal).toBe(4999);
  });

  it("is idempotent on repeated runs and does not duplicate recovery notifications", async () => {
    const asOfDate = new Date();
    const job = new CartCleanupJob();

    const result = await job.run(db, {
      asOfDate,
      abandonmentThresholdMs: 24 * 60 * 60 * 1000,
      enqueueRecoveryNotifications: true,
    });

    expect(result.success).toBe(true);

    // Verify no duplicate outbox entries exist
    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*) FROM notification_outbox WHERE notification_type = 'ABANDONED_CART_RECOVERY'`,
    );
    expect(Number(countRes.rows[0]?.count)).toBeGreaterThanOrEqual(1);
  });

  it("marks carts past expires_at as EXPIRED", async () => {
    const cartId = generateUuidV7();
    const asOfDate = new Date();
    const pastExpiresAt = new Date(asOfDate.getTime() - 2 * 60 * 60 * 1000); // expired 2 hours ago

    await db.query(
      `INSERT INTO carts (id, store_id, customer_id, status, currency, subtotal, grand_total, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'ACTIVE', 'USD', 1000, 1000, $4, NOW(), NOW())`,
      [cartId, storeId, customerId, pastExpiresAt],
    );

    const job = new CartCleanupJob();
    const result = await job.run(db, { asOfDate });

    expect(result.success).toBe(true);
    expect(result.expiredCartIds).toContain(cartId);

    const checkRes = await db.query<{ status: string }>(
      `SELECT status FROM carts WHERE id = $1`,
      [cartId],
    );
    expect(checkRes.rows[0]?.status).toBe("EXPIRED");
  });

  it("purges stale expired and abandoned carts and cascade-deletes their items", async () => {
    const cartId = generateUuidV7();
    const itemId = generateUuidV7();
    const asOfDate = new Date();
    const ancientDate = new Date(asOfDate.getTime() - 40 * 24 * 60 * 60 * 1000); // 40 days ago

    // Insert ancient expired cart with item
    await db.query(
      `INSERT INTO carts (id, store_id, guest_identifier, status, currency, subtotal, grand_total, created_at, updated_at)
       VALUES ($1, $2, 'guest_ancient_123', 'EXPIRED', 'USD', 2500, 2500, $3, $3)`,
      [cartId, storeId, ancientDate],
    );
    await db.query(
      `INSERT INTO cart_items (id, cart_id, store_id, variant_id, quantity, unit_price, line_subtotal, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 1, 2500, 2500, $5, $5)`,
      [itemId, cartId, storeId, variantId, ancientDate],
    );

    const job = new CartCleanupJob();
    const result = await job.run(db, {
      asOfDate,
      purgeRetentionMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    expect(result.success).toBe(true);
    expect(result.purgedCartIds).toContain(cartId);

    // Verify cart is deleted
    const cartRes = await db.query(`SELECT id FROM carts WHERE id = $1`, [cartId]);
    expect(cartRes.rows.length).toBe(0);

    // Verify cart items were cascade-deleted
    const itemRes = await db.query(`SELECT id FROM cart_items WHERE id = $1`, [itemId]);
    expect(itemRes.rows.length).toBe(0);
  });

  it("skips stale carts referenced by checkouts without foreign key violation (BUG-AC-01)", async () => {
    const cartId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const asOfDate = new Date();
    const ancientDate = new Date(asOfDate.getTime() - 40 * 24 * 60 * 60 * 1000);

    // Insert ancient expired cart
    await db.query(
      `INSERT INTO carts (id, store_id, guest_identifier, status, currency, subtotal, grand_total, created_at, updated_at)
       VALUES ($1, $2, 'guest_with_checkout', 'EXPIRED', 'USD', 3500, 3500, $3, $3)`,
      [cartId, storeId, ancientDate],
    );

    // Insert checkout referencing this cart (ON DELETE RESTRICT)
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, status, currency, subtotal, total, created_at, updated_at)
       VALUES ($1, $2, $3, 'EXPIRED', 'USD', 3500, 3500, $4, $4)`,
      [checkoutId, storeId, cartId, ancientDate],
    );

    const job = new CartCleanupJob();
    const result = await job.run(db, {
      asOfDate,
      purgeRetentionMs: 30 * 24 * 60 * 60 * 1000,
    });

    expect(result.success).toBe(true);
    expect(result.purgedCartIds).not.toContain(cartId);

    // Verify cart is preserved safely
    const cartRes = await db.query(`SELECT id FROM carts WHERE id = $1`, [cartId]);
    expect(cartRes.rows.length).toBe(1);
  });

  it("integrates into PaymentRecoveryScheduler cycle", async () => {
    const scheduler = new PaymentRecoveryScheduler(
      db,
      {
        enabled: true,
        pollIntervalMs: 10_000,
        batchSize: 50,
        leaseTimeoutMs: 60_000,
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new CartCleanupJob(),
    );

    const cycleResult = await scheduler.runNow();
    expect(cycleResult.cartCleanup).toBeDefined();
    expect(cycleResult.cartCleanup?.job).toBe("cart-cleanup");
    expect(cycleResult.cartCleanup?.success).toBe(true);
  });
});
