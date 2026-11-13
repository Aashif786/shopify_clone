import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { InventoryService, ReservationReleaseService } from "@calcart/inventory";
import { InventoryExpirationRecoveryJob } from "../../apps/worker/src/jobs/inventory/inventory-expiration-recovery-job.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

/**
 * Order-owned reservations (docs/decisions/ADR-016): once a captured payment
 * re-points a checkout reservation to its order, the checkout TTL no longer
 * applies. The reservation is released by cancellation or committed on dispatch.
 */
describe("Order reservation lifecycle", { timeout: 60_000 }, () => {
  // One migrated database for the file; every test seeds its own store, so the
  // tests stay independent while avoiding a full migration run per test.
  let close: (() => Promise<void>) | undefined;
  let db: Database;

  beforeAll(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
  }, 120_000);

  afterAll(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function seedStore(
    db: Database,
    slug: string,
    available: number,
    reserved: number,
  ): Promise<{ storeId: string; inventoryItemId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const inventoryItemId = generateUuidV7();

    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`, [
      orgId,
      `Org ${slug}`,
    ]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'UTC')`,
      [storeId, orgId, `Store ${slug}`, slug],
    );
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Product', $3, 'ACTIVE')`,
      [productId, storeId, `product-${slug}`],
    );
    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Standard', $4, 5000, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId, `SKU-${slug}`],
    );
    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, $4, $5)`,
      [inventoryItemId, storeId, variantId, available, reserved],
    );

    return { storeId, inventoryItemId };
  }

  async function insertReservation(
    db: Database,
    store: { storeId: string; inventoryItemId: string },
    input: {
      referenceType: string;
      referenceId: string;
      quantity: number;
      status: "ACTIVE" | "RELEASED" | "COMMITTED";
      expiredMinutesAgo: number;
    },
  ): Promise<string> {
    const id = generateUuidV7();
    await db.query(
      `INSERT INTO inventory_reservations (
         id, store_id, inventory_item_id, reference_type, reference_id,
         quantity, status, expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7,
                 NOW() - ($8 || ' minutes')::interval, NOW() - INTERVAL '60 minutes', NOW() - INTERVAL '60 minutes')`,
      [
        id,
        store.storeId,
        store.inventoryItemId,
        input.referenceType,
        input.referenceId,
        input.quantity,
        input.status,
        String(input.expiredMinutesAgo),
      ],
    );
    return id;
  }

  async function readItem(db: Database, itemId: string) {
    const res = await db.query<{ available_quantity: number; reserved_quantity: number }>(
      `SELECT available_quantity, reserved_quantity FROM inventory_items WHERE id = $1`,
      [itemId],
    );
    return res.rows[0]!;
  }

  async function readStatus(db: Database, reservationId: string): Promise<string> {
    const res = await db.query<{ status: string }>(
      `SELECT status FROM inventory_reservations WHERE id = $1`,
      [reservationId],
    );
    return res.rows[0]!.status;
  }

  describe("expiry", () => {
    it("does not release an ACTIVE reservation that belongs to an order, even past its checkout TTL", async () => {
      const store = await seedStore(db, "exp-order", 8, 2);
      const orderReservation = await insertReservation(db, store, {
        referenceType: "order",
        referenceId: generateUuidV7(),
        quantity: 2,
        status: "ACTIVE",
        expiredMinutesAgo: 30,
      });

      const result = await new InventoryExpirationRecoveryJob().run(db);

      expect(result.recoveredCount).toBe(0);
      expect(await readStatus(db, orderReservation)).toBe("ACTIVE");
      expect(await readItem(db, store.inventoryItemId)).toEqual({
        available_quantity: 8,
        reserved_quantity: 2,
      });
    });

    it("still releases an expired checkout reservation next to an order reservation", async () => {
      const store = await seedStore(db, "exp-mixed", 6, 5);
      const orderReservation = await insertReservation(db, store, {
        referenceType: "order",
        referenceId: generateUuidV7(),
        quantity: 2,
        status: "ACTIVE",
        expiredMinutesAgo: 30,
      });
      const checkoutReservation = await insertReservation(db, store, {
        referenceType: "checkout",
        referenceId: generateUuidV7(),
        quantity: 3,
        status: "ACTIVE",
        expiredMinutesAgo: 30,
      });

      const result = await new InventoryExpirationRecoveryJob().run(db);

      expect(result.recoveredCount).toBe(1);
      expect(result.releasedReservationIds).toEqual([checkoutReservation]);
      expect(await readStatus(db, orderReservation)).toBe("ACTIVE");
      expect(await readItem(db, store.inventoryItemId)).toEqual({
        available_quantity: 9,
        reserved_quantity: 2,
      });
    });

    it("keeps order reservations out of the per-store expiry sweep too", async () => {
      const store = await seedStore(db, "exp-store", 8, 2);
      const orderReservation = await insertReservation(db, store, {
        referenceType: "order",
        referenceId: generateUuidV7(),
        quantity: 2,
        status: "ACTIVE",
        expiredMinutesAgo: 30,
      });

      const result = await new InventoryService().expireReservations(db, store.storeId);

      expect(result.expiredCount).toBe(0);
      expect(await readStatus(db, orderReservation)).toBe("ACTIVE");
    });
  });

  describe("commitOrderReservations", () => {
    const service = new ReservationReleaseService();

    it("consumes reserved stock and marks the order's reservations COMMITTED", async () => {
      const store = await seedStore(db, "commit-ok", 8, 3);
      const orderId = generateUuidV7();
      const reservationId = await insertReservation(db, store, {
        referenceType: "order",
        referenceId: orderId,
        quantity: 3,
        status: "ACTIVE",
        expiredMinutesAgo: 30,
      });

      const result = await service.commitOrderReservations(db, {
        storeId: store.storeId,
        orderId,
      });

      expect(result.committedCount).toBe(1);
      expect(result.skippedCount).toBe(0);
      expect(await readStatus(db, reservationId)).toBe("COMMITTED");
      // available was already reduced when the stock was reserved; only the
      // reserved counter is consumed.
      expect(await readItem(db, store.inventoryItemId)).toEqual({
        available_quantity: 8,
        reserved_quantity: 0,
      });
    });

    it("is idempotent: a second commit changes nothing", async () => {
      const store = await seedStore(db, "commit-twice", 8, 3);
      const orderId = generateUuidV7();
      await insertReservation(db, store, {
        referenceType: "order",
        referenceId: orderId,
        quantity: 3,
        status: "ACTIVE",
        expiredMinutesAgo: 0,
      });

      await service.commitOrderReservations(db, { storeId: store.storeId, orderId });
      const second = await service.commitOrderReservations(db, {
        storeId: store.storeId,
        orderId,
      });

      expect(second.committedCount).toBe(0);
      expect(second.skippedCount).toBe(1);
      expect(await readItem(db, store.inventoryItemId)).toEqual({
        available_quantity: 8,
        reserved_quantity: 0,
      });
    });

    it("skips reservations that were already RELEASED instead of consuming stock", async () => {
      const store = await seedStore(db, "commit-released", 10, 0);
      const orderId = generateUuidV7();
      const reservationId = await insertReservation(db, store, {
        referenceType: "order",
        referenceId: orderId,
        quantity: 2,
        status: "RELEASED",
        expiredMinutesAgo: 30,
      });

      const result = await service.commitOrderReservations(db, {
        storeId: store.storeId,
        orderId,
      });

      expect(result.committedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(await readStatus(db, reservationId)).toBe("RELEASED");
      expect(await readItem(db, store.inventoryItemId)).toEqual({
        available_quantity: 10,
        reserved_quantity: 0,
      });
    });

    it("never touches another store's reservation that shares the order id", async () => {
      const storeA = await seedStore(db, "commit-a", 8, 3);
      const storeB = await seedStore(db, "commit-b", 8, 3);
      const orderId = generateUuidV7();
      const reservationB = await insertReservation(db, storeB, {
        referenceType: "order",
        referenceId: orderId,
        quantity: 3,
        status: "ACTIVE",
        expiredMinutesAgo: 0,
      });

      const result = await service.commitOrderReservations(db, {
        storeId: storeA.storeId,
        orderId,
      });

      expect(result.committedCount).toBe(0);
      expect(await readStatus(db, reservationB)).toBe("ACTIVE");
      expect(await readItem(db, storeB.inventoryItemId)).toEqual({
        available_quantity: 8,
        reserved_quantity: 3,
      });
    });

    it("rejects a missing orderId", async () => {
      const store = await seedStore(db, "commit-noid", 1, 0);

      await expect(
        service.commitOrderReservations(db, { storeId: store.storeId, orderId: "" }),
      ).rejects.toThrow(/orderId/);
    });
  });

  describe("cancellation after the TTL", () => {
    it("still restores stock when an order reservation is released on cancellation", async () => {
      const store = await seedStore(db, "cancel-after-ttl", 8, 2);
      const orderId = generateUuidV7();
      const reservationId = await insertReservation(db, store, {
        referenceType: "order",
        referenceId: orderId,
        quantity: 2,
        status: "ACTIVE",
        expiredMinutesAgo: 30,
      });

      // Sweep first: it must leave the order reservation alone.
      await new InventoryExpirationRecoveryJob().run(db);
      const released = await new ReservationReleaseService().releaseOrderReservations(db, {
        storeId: store.storeId,
        orderId,
      });

      expect(released.releasedCount).toBe(1);
      expect(await readStatus(db, reservationId)).toBe("RELEASED");
      expect(await readItem(db, store.inventoryItemId)).toEqual({
        available_quantity: 10,
        reserved_quantity: 0,
      });
    });
  });
});
