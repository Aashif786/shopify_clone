import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { serializeSessionCookie } from "@calcart/auth";
import { StoreService } from "@calcart/stores";
import { OrderService } from "@calcart/orders";
import { createIsolatedDatabase } from "../helpers/postgres.js";

import { POST as updateOrderStatus } from "../../apps/web/app/api/v1/stores/[storeId]/orders/[orderId]/status/route.js";
import { POST as fulfillOrder } from "../../apps/web/app/api/v1/stores/[storeId]/orders/[orderId]/fulfill/route.js";

declare global {
  var __calcart_web_db: unknown;
}

type SeedStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "COMPLETED";

/**
 * POST /api/v1/stores/[storeId]/orders/[orderId]/status and the stock commit
 * that fulfilling or shipping an order performs (docs/decisions/ADR-016).
 *
 * One migrated database serves the whole file; every test creates its own
 * store, so tests do not share rows.
 */
describe("Order status API and stock commit", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();
  const orderService = new OrderService();

  beforeAll(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__calcart_web_db = isolated.database;
  }, 120_000);

  afterAll(async () => {
    global.__calcart_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function createAuthenticatedUser(email: string) {
    const userId = generateUuidV7();
    const sessionId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Test User', 'scrypt:hash', 'ACTIVE')`,
      [userId, email],
    );
    const expiresAt = new Date(Date.now() + 86_400_000);
    await db.query(`INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`, [
      sessionId,
      userId,
      expiresAt,
    ]);
    return {
      userId,
      cookie: serializeSessionCookie(sessionId, { expires: expiresAt }),
    };
  }

  let seq = 0;
  function uniqueEmail(prefix: string): string {
    seq += 1;
    return `${prefix}-${seq}-${Date.now()}@test.com`;
  }

  async function createStoreWithOwner() {
    const user = await createAuthenticatedUser(uniqueEmail("owner"));
    const store = await storeService.createStore(db, user.userId, {
      name: "Status Test Store",
      slug: `store-${Date.now()}-${Math.floor(Math.random() * 100_000)}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    return { user, store };
  }

  async function createMember(storeId: string, role: "staff" | "admin") {
    const user = await createAuthenticatedUser(uniqueEmail(role));
    await db.query(
      `INSERT INTO store_memberships (id, store_id, user_id, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE', NOW(), NOW())`,
      [generateUuidV7(), storeId, user.userId, role],
    );
    return user;
  }

  async function seedOrder(storeId: string, status: SeedStatus = "PENDING") {
    const cartId = generateUuidV7();
    await db.query(`INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`, [
      cartId,
      storeId,
    ]);
    const checkoutId = generateUuidV7();
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, 6000, 'COMPLETED', 'PAID', 'USD')`,
      [checkoutId, storeId, cartId],
    );
    return orderService.createOrderFromCheckout(db, {
      storeId,
      checkout: {
        id: checkoutId,
        storeId,
        customerId: null,
        currency: "USD",
        items: [
          {
            productNameSnapshot: "Vintage Jacket",
            variantNameSnapshot: "Large / Brown",
            skuSnapshot: "JKT-L-BRN",
            unitPrice: 6000,
            quantity: 1,
          },
        ],
        shippingAddress: {
          firstName: "John",
          lastName: "Doe",
          addressLine1: "123 Broadway",
          city: "New York",
          postalCode: "10001",
          country: "USA",
        },
      },
      initialStatus: status,
    });
  }

  /** Stock held for an order: available 4, reserved 1, one ACTIVE order reservation. */
  async function seedOrderReservation(storeId: string, orderId: string) {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const inventoryItemId = generateUuidV7();
    const reservationId = generateUuidV7();
    const suffix = generateUuidV7();

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status) VALUES ($1, $2, 'Jacket', $3, 'ACTIVE')`,
      [productId, storeId, `jacket-${suffix}`],
    );
    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Large', $4, 6000, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId, `SKU-${suffix}`],
    );
    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, 4, 1)`,
      [inventoryItemId, storeId, variantId],
    );
    await db.query(
      `INSERT INTO inventory_reservations (
         id, store_id, inventory_item_id, reference_type, reference_id,
         quantity, status, expires_at
       ) VALUES ($1, $2, $3, 'order', $4, 1, 'ACTIVE', NOW() - INTERVAL '2 hours')`,
      [reservationId, storeId, inventoryItemId, orderId],
    );
    return { reservationId, inventoryItemId };
  }

  async function reservationStatus(reservationId: string): Promise<string> {
    const res = await db.query<{ status: string }>(
      `SELECT status FROM inventory_reservations WHERE id = $1`,
      [reservationId],
    );
    return res.rows[0]!.status;
  }

  async function reservedQuantity(inventoryItemId: string): Promise<number> {
    const res = await db.query<{ reserved_quantity: number }>(
      `SELECT reserved_quantity FROM inventory_items WHERE id = $1`,
      [inventoryItemId],
    );
    return res.rows[0]!.reserved_quantity;
  }

  async function orderRow(orderId: string) {
    const res = await db.query<{ status: string; fulfillment_status: string }>(
      `SELECT status, fulfillment_status FROM orders WHERE id = $1`,
      [orderId],
    );
    return res.rows[0]!;
  }

  function postStatus(
    storeId: string,
    orderId: string,
    body: unknown,
    cookie?: string,
  ): Promise<Response> {
    const req = new Request(
      `http://localhost:3000/api/v1/stores/${storeId}/orders/${orderId}/status`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify(body),
      },
    );
    return updateOrderStatus(req, { params: Promise.resolve({ storeId, orderId }) });
  }

  function postFulfill(
    storeId: string,
    orderId: string,
    body: unknown,
    cookie: string,
  ): Promise<Response> {
    const req = new Request(
      `http://localhost:3000/api/v1/stores/${storeId}/orders/${orderId}/fulfill`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(body),
      },
    );
    return fulfillOrder(req, { params: Promise.resolve({ storeId, orderId }) });
  }

  describe("authentication and authorization", () => {
    it("rejects an unauthenticated request with 401", async () => {
      const { store } = await createStoreWithOwner();
      const order = await seedOrder(store.id);

      const res = await postStatus(store.id, order.id, { toStatus: "CONFIRMED" });

      expect(res.status).toBe(401);
      expect((await res.json()).error.code).toBe("AUTHENTICATION_REQUIRED");
      expect((await orderRow(order.id)).status).toBe("PENDING");
    });

    it("hides the order from a user who is not a member of the store (404)", async () => {
      const { store } = await createStoreWithOwner();
      const order = await seedOrder(store.id);
      const outsider = await createAuthenticatedUser(uniqueEmail("outsider"));

      const res = await postStatus(store.id, order.id, { toStatus: "CONFIRMED" }, outsider.cookie);

      expect(res.status).toBe(404);
      expect((await orderRow(order.id)).status).toBe("PENDING");
    });

    it("lets a staff member confirm an order and records them as the actor", async () => {
      const { store } = await createStoreWithOwner();
      const order = await seedOrder(store.id);
      const staff = await createMember(store.id, "staff");

      const res = await postStatus(
        store.id,
        order.id,
        { toStatus: "CONFIRMED", reason: "Stock checked" },
        staff.cookie,
      );

      expect(res.status).toBe(200);
      expect((await res.json()).data.status).toBe("CONFIRMED");

      const history = await db.query<{
        from_status: string;
        to_status: string;
        reason: string | null;
        actor_type: string;
        actor_id: string | null;
      }>(
        `SELECT from_status, to_status, reason, actor_type, actor_id
         FROM order_status_history WHERE order_id = $1 AND to_status = 'CONFIRMED'`,
        [order.id],
      );
      expect(history.rows).toHaveLength(1);
      expect(history.rows[0]).toMatchObject({
        from_status: "PENDING",
        reason: "Stock checked",
        actor_type: "MERCHANT",
        actor_id: staff.userId,
      });
    });

    it("never changes an order that belongs to a different store (403)", async () => {
      const storeA = await createStoreWithOwner();
      const storeB = await createStoreWithOwner();
      const orderOfA = await seedOrder(storeA.store.id);

      // A real member of store B, but pointing at store A's order id.
      const res = await postStatus(
        storeB.store.id,
        orderOfA.id,
        { toStatus: "CONFIRMED" },
        storeB.user.cookie,
      );

      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("CROSS_STORE_ORDER_ACCESS");
      expect((await orderRow(orderOfA.id)).status).toBe("PENDING");
    });
  });

  describe("validation", () => {
    it.each([
      ["CANCELLED", { toStatus: "CANCELLED" }],
      ["PENDING", { toStatus: "PENDING" }],
      ["an unknown status", { toStatus: "TELEPORTED" }],
      ["a missing status", {}],
      ["a non-string status", { toStatus: 42 }],
    ])("rejects %s with 400 and leaves the order untouched", async (_label, body) => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedOrder(store.id);

      const res = await postStatus(store.id, order.id, body, user.cookie);

      expect(res.status).toBe(400);
      expect((await res.json()).success).toBe(false);
      expect((await orderRow(order.id)).status).toBe("PENDING");
    });

    it("rejects an over-long reason", async () => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedOrder(store.id);

      const res = await postStatus(
        store.id,
        order.id,
        { toStatus: "CONFIRMED", reason: "x".repeat(501) },
        user.cookie,
      );

      expect(res.status).toBe(400);
    });

    it("rejects a malformed order id before touching the database", async () => {
      const { user, store } = await createStoreWithOwner();

      const res = await postStatus(store.id, "not-a-uuid", { toStatus: "CONFIRMED" }, user.cookie);

      expect(res.status).toBe(400);
    });
  });

  describe("state machine", () => {
    it("walks an order through confirm, process, ship, deliver and complete", async () => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedOrder(store.id);

      for (const toStatus of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"]) {
        const res = await postStatus(store.id, order.id, { toStatus }, user.cookie);
        expect(res.status, `moving to ${toStatus}`).toBe(200);
        expect((await res.json()).data.status).toBe(toStatus);
      }

      const final = await orderRow(order.id);
      expect(final.status).toBe("COMPLETED");
      expect(final.fulfillment_status).toBe("FULFILLED");
    });

    it("refuses to skip a step", async () => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedOrder(store.id);

      const res = await postStatus(store.id, order.id, { toStatus: "DELIVERED" }, user.cookie);

      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("INVALID_ORDER_STATUS_TRANSITION");
      expect((await orderRow(order.id)).status).toBe("PENDING");
    });

    it("refuses to move a completed order", async () => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedOrder(store.id, "COMPLETED");

      const res = await postStatus(store.id, order.id, { toStatus: "DELIVERED" }, user.cookie);

      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("ORDER_IMMUTABLE");
    });

    it("is idempotent when the order is already in the requested status", async () => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedOrder(store.id, "CONFIRMED");

      const countHistory = async (): Promise<number> =>
        (await db.query(`SELECT 1 FROM order_status_history WHERE order_id = $1`, [order.id])).rows
          .length;
      const before = await countHistory();

      const res = await postStatus(store.id, order.id, { toStatus: "CONFIRMED" }, user.cookie);

      expect(res.status).toBe(200);
      expect((await res.json()).data.status).toBe("CONFIRMED");
      expect(await countHistory()).toBe(before);
    });

    it("lets an order that was fulfilled while still processing be shipped", async () => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedOrder(store.id, "PROCESSING");
      // The state of an order fulfilled before the status endpoint existed:
      // fulfillment recorded, but the order never advanced past PROCESSING.
      await db.query(`UPDATE orders SET fulfillment_status = 'FULFILLED' WHERE id = $1`, [order.id]);

      const res = await postStatus(store.id, order.id, { toStatus: "SHIPPED" }, user.cookie);

      expect(res.status).toBe(200);
      expect((await res.json()).data.status).toBe("SHIPPED");
    });
  });

  describe("stock commit on dispatch", () => {
    it("consumes the order's reserved stock when the order is shipped via the status endpoint", async () => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedOrder(store.id, "PROCESSING");
      const stock = await seedOrderReservation(store.id, order.id);

      const res = await postStatus(store.id, order.id, { toStatus: "SHIPPED" }, user.cookie);

      expect(res.status).toBe(200);
      expect(await reservationStatus(stock.reservationId)).toBe("COMMITTED");
      expect(await reservedQuantity(stock.inventoryItemId)).toBe(0);
    });

    it("does not touch stock for steps before dispatch", async () => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedOrder(store.id, "PENDING");
      const stock = await seedOrderReservation(store.id, order.id);

      await postStatus(store.id, order.id, { toStatus: "CONFIRMED" }, user.cookie);
      await postStatus(store.id, order.id, { toStatus: "PROCESSING" }, user.cookie);

      expect(await reservationStatus(stock.reservationId)).toBe("ACTIVE");
      expect(await reservedQuantity(stock.inventoryItemId)).toBe(1);
    });

    it("consumes the order's reserved stock when the order is fulfilled", async () => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedOrder(store.id, "CONFIRMED");
      const stock = await seedOrderReservation(store.id, order.id);

      const res = await postFulfill(
        store.id,
        order.id,
        { fulfillmentStatus: "FULFILLED", carrier: "DHL", trackingNumber: "T-1" },
        user.cookie,
      );

      expect(res.status).toBe(200);
      expect((await res.json()).data.status).toBe("SHIPPED");
      expect(await reservationStatus(stock.reservationId)).toBe("COMMITTED");
      expect(await reservedQuantity(stock.inventoryItemId)).toBe(0);
    });

    it("keeps the stock reserved for a partial fulfillment", async () => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedOrder(store.id, "CONFIRMED");
      const stock = await seedOrderReservation(store.id, order.id);

      const res = await postFulfill(
        store.id,
        order.id,
        { fulfillmentStatus: "PARTIALLY_FULFILLED" },
        user.cookie,
      );

      expect(res.status).toBe(200);
      expect(await reservationStatus(stock.reservationId)).toBe("ACTIVE");
      expect(await reservedQuantity(stock.inventoryItemId)).toBe(1);
    });

    it("leaves the stock reserved when the status change is refused", async () => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedOrder(store.id, "PENDING");
      const stock = await seedOrderReservation(store.id, order.id);

      // PENDING cannot jump to SHIPPED.
      const res = await postStatus(store.id, order.id, { toStatus: "SHIPPED" }, user.cookie);

      expect(res.status).toBe(400);
      expect((await orderRow(order.id)).status).toBe("PENDING");
      expect(await reservationStatus(stock.reservationId)).toBe("ACTIVE");
      expect(await reservedQuantity(stock.inventoryItemId)).toBe(1);
    });

    it("does not commit another store's reservation that shares the order id", async () => {
      const storeA = await createStoreWithOwner();
      const storeB = await createStoreWithOwner();
      const orderA = await seedOrder(storeA.store.id, "PROCESSING");
      // Same order id string, but the reservation belongs to store B.
      const foreign = await seedOrderReservation(storeB.store.id, orderA.id);

      const res = await postStatus(
        storeA.store.id,
        orderA.id,
        { toStatus: "SHIPPED" },
        storeA.user.cookie,
      );

      expect(res.status).toBe(200);
      expect(await reservationStatus(foreign.reservationId)).toBe("ACTIVE");
      expect(await reservedQuantity(foreign.inventoryItemId)).toBe(1);
    });
  });
});
