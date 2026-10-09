import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@shopify-clone/db";
import { serializeSessionCookie } from "@shopify-clone/auth";
import { StoreService } from "@shopify-clone/stores";
import { OrderService } from "@shopify-clone/orders";
import { createIsolatedDatabase } from "../helpers/postgres.js";

import { GET as getOrders } from "../../apps/web/app/api/v1/stores/[storeId]/orders/route.js";
import { GET as getOrder } from "../../apps/web/app/api/v1/stores/[storeId]/orders/[orderId]/route.js";
import { POST as cancelOrder } from "../../apps/web/app/api/v1/stores/[storeId]/orders/[orderId]/cancel/route.js";

declare global {
  var __shopify_clone_web_db: unknown;
}

describe("Orders API Endpoints (/api/v1/stores/[storeId]/orders/*)", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();
  const orderService = new OrderService();

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__shopify_clone_web_db = isolated.database;
  });

  afterEach(async () => {
    global.__shopify_clone_web_db = undefined;
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

    const expiresAt = new Date(Date.now() + 86400000);
    await db.query(
      `INSERT INTO sessions (id, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [sessionId, userId, expiresAt],
    );

    const cookie = serializeSessionCookie(sessionId, { expires: expiresAt });
    return { userId, sessionId, cookie };
  }

  async function createStoreWithOwner(email = "owner@test.com") {
    const user = await createAuthenticatedUser(email);
    const store = await storeService.createStore(db, user.userId, {
      name: "Orders Test Store",
      slug: `store-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    return { user, store };
  }

  async function createStaffUser(storeId: string, email = "staff@test.com") {
    const user = await createAuthenticatedUser(email);
    await db.query(
      `INSERT INTO store_memberships (id, store_id, user_id, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'staff', 'ACTIVE', NOW(), NOW())`,
      [generateUuidV7(), storeId, user.userId],
    );
    return user;
  }

  async function seedTestOrder(
    storeId: string,
    options?: {
      customerId?: string;
      status?: "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "COMPLETED";
    },
  ) {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );
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
        customerId: options?.customerId ?? null,
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
      initialStatus: options?.status ?? "PENDING",
    });
  }

  describe("Authentication & Authorization Gates", () => {
    it("rejects unauthenticated GET /orders with 401 AUTHENTICATION_REQUIRED", async () => {
      const { store } = await createStoreWithOwner();
      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/orders`, {
        method: "GET",
      });

      const res = await getOrders(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("rejects unauthenticated GET /orders/:orderId with 401 AUTHENTICATION_REQUIRED", async () => {
      const { store } = await createStoreWithOwner();
      const order = await seedTestOrder(store.id);

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/orders/${order.id}`,
        { method: "GET" },
      );

      const res = await getOrder(req, {
        params: Promise.resolve({ storeId: store.id, orderId: order.id }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated POST /orders/:orderId/cancel with 401 AUTHENTICATION_REQUIRED", async () => {
      const { store } = await createStoreWithOwner();
      const order = await seedTestOrder(store.id);

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/orders/${order.id}/cancel`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "Unauthenticated cancellation" }),
        },
      );

      const res = await cancelOrder(req, {
        params: Promise.resolve({ storeId: store.id, orderId: order.id }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects non-member user with 404 NOT_FOUND (preventing tenant enumeration)", async () => {
      const { store } = await createStoreWithOwner("owner@test.com");
      const outsider = await createAuthenticatedUser("outsider@test.com");

      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/orders`, {
        method: "GET",
        headers: { cookie: outsider.cookie },
      });

      const res = await getOrders(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("rejects staff member attempting cancellation with 403 FORBIDDEN", async () => {
      const { store } = await createStoreWithOwner();
      const staff = await createStaffUser(store.id, "staff-cancel@test.com");
      const order = await seedTestOrder(store.id);

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/orders/${order.id}/cancel`,
        {
          method: "POST",
          headers: {
            cookie: staff.cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({ reason: "Staff cancellation attempt" }),
        },
      );

      const res = await cancelOrder(req, {
        params: Promise.resolve({ storeId: store.id, orderId: order.id }),
      });
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("FORBIDDEN");
    });

    it("rejects invalid non-UUID storeId and orderId with 400 VALIDATION_ERROR", async () => {
      const { user, store } = await createStoreWithOwner();

      const invalidStoreReq = new Request(
        `http://localhost:3000/api/v1/stores/not-a-uuid/orders`,
        {
          method: "GET",
          headers: { cookie: user.cookie },
        },
      );
      const res1 = await getOrders(invalidStoreReq, {
        params: Promise.resolve({ storeId: "not-a-uuid" }),
      });
      expect(res1.status).toBe(400);

      const invalidOrderReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/orders/bad-order-uuid`,
        {
          method: "GET",
          headers: { cookie: user.cookie },
        },
      );
      const res2 = await getOrder(invalidOrderReq, {
        params: Promise.resolve({ storeId: store.id, orderId: "bad-order-uuid" }),
      });
      expect(res2.status).toBe(400);
    });
  });

  describe("GET /api/v1/stores/[storeId]/orders (List Orders)", () => {
    it("returns paginated list of orders scoped to the store", async () => {
      const { user, store } = await createStoreWithOwner();
      const order1 = await seedTestOrder(store.id);
      const order2 = await seedTestOrder(store.id);

      // Create another store with its own order
      const { store: otherStore } = await createStoreWithOwner("other@test.com");
      await seedTestOrder(otherStore.id);

      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/orders`, {
        method: "GET",
        headers: { cookie: user.cookie },
      });

      const res = await getOrders(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.items).toHaveLength(2);
      expect(json.data.hasMore).toBe(false);

      const ids = json.data.items.map((o: { id: string }) => o.id);
      expect(ids).toContain(order1.id);
      expect(ids).toContain(order2.id);
    });

    it("supports staff members viewing orders", async () => {
      const { store } = await createStoreWithOwner();
      const staff = await createStaffUser(store.id);
      await seedTestOrder(store.id);

      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/orders`, {
        method: "GET",
        headers: { cookie: staff.cookie },
      });

      const res = await getOrders(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.items).toHaveLength(1);
    });

    it("filters orders by status", async () => {
      const { user, store } = await createStoreWithOwner();
      await seedTestOrder(store.id, { status: "PENDING" });
      await seedTestOrder(store.id, { status: "CONFIRMED" });

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/orders?status=CONFIRMED`,
        {
          method: "GET",
          headers: { cookie: user.cookie },
        },
      );

      const res = await getOrders(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.items).toHaveLength(1);
      expect(json.data.items[0].status).toBe("CONFIRMED");
    });

    it("rejects invalid status filter parameter with 400 VALIDATION_ERROR", async () => {
      const { user, store } = await createStoreWithOwner();

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/orders?status=INVALID_STATUS`,
        {
          method: "GET",
          headers: { cookie: user.cookie },
        },
      );

      const res = await getOrders(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects invalid limit parameter with 400 VALIDATION_ERROR", async () => {
      const { user, store } = await createStoreWithOwner();

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/orders?limit=999`,
        {
          method: "GET",
          headers: { cookie: user.cookie },
        },
      );

      const res = await getOrders(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/stores/[storeId]/orders/[orderId] (Get Order Detail)", () => {
    it("returns complete order detail including items and addresses", async () => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedTestOrder(store.id);

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/orders/${order.id}`,
        {
          method: "GET",
          headers: { cookie: user.cookie },
        },
      );

      const res = await getOrder(req, {
        params: Promise.resolve({ storeId: store.id, orderId: order.id }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(order.id);
      expect(json.data.orderNumber).toBe(order.orderNumber);
      expect(json.data.status).toBe("PENDING");
      expect(json.data.subtotal).toBe(6000);
      expect(json.data.items).toHaveLength(1);
      expect(json.data.items[0].productNameSnapshot).toBe("Vintage Jacket");
      expect(json.data.addresses).toHaveLength(1);
      expect(json.data.addresses[0].city).toBe("New York");
    });

    it("returns 404 ORDER_NOT_FOUND for non-existent order", async () => {
      const { user, store } = await createStoreWithOwner();
      const nonExistentId = generateUuidV7();

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/orders/${nonExistentId}`,
        {
          method: "GET",
          headers: { cookie: user.cookie },
        },
      );

      const res = await getOrder(req, {
        params: Promise.resolve({ storeId: store.id, orderId: nonExistentId }),
      });
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("ORDER_NOT_FOUND");
    });

    it("returns 404 ORDER_NOT_FOUND when accessing an order belonging to another store", async () => {
      const { user: userA, store: storeA } = await createStoreWithOwner("storeA@test.com");
      const { store: storeB } = await createStoreWithOwner("storeB@test.com");

      // Seed order in Store B
      const orderB = await seedTestOrder(storeB.id);

      // User A attempts to view Order B through Store A endpoint
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${storeA.id}/orders/${orderB.id}`,
        {
          method: "GET",
          headers: { cookie: userA.cookie },
        },
      );

      const res = await getOrder(req, {
        params: Promise.resolve({ storeId: storeA.id, orderId: orderB.id }),
      });
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("ORDER_NOT_FOUND");
    });
  });

  describe("POST /api/v1/stores/[storeId]/orders/[orderId]/cancel (Cancel Order)", () => {
    it("successfully cancels an order and records actor identity in status history", async () => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedTestOrder(store.id);

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/orders/${order.id}/cancel`,
        {
          method: "POST",
          headers: {
            cookie: user.cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({ reason: "Customer requested cancellation via support" }),
        },
      );

      const res = await cancelOrder(req, {
        params: Promise.resolve({ storeId: store.id, orderId: order.id }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("CANCELLED");
      expect(json.data.cancelReason).toBe("Customer requested cancellation via support");
      expect(json.data.cancelledAt).not.toBeNull();
      expect(json.data.fulfillmentStatus).toBe("CANCELLED");

      // Verify DB status history has actor_id matching authenticated user
      const historyRes = await db.query(
        `SELECT * FROM order_status_history WHERE order_id = $1 AND to_status = 'CANCELLED'`,
        [order.id],
      );
      expect(historyRes.rows).toHaveLength(1);
      expect(historyRes.rows[0].actor_type).toBe("MERCHANT");
      expect(historyRes.rows[0].actor_id).toBe(user.userId);
    });

    it("rejects cancellation without reason with 400 VALIDATION_ERROR", async () => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedTestOrder(store.id);

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/orders/${order.id}/cancel`,
        {
          method: "POST",
          headers: {
            cookie: user.cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({ reason: "   " }),
        },
      );

      const res = await cancelOrder(req, {
        params: Promise.resolve({ storeId: store.id, orderId: order.id }),
      });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects repeated cancellation of already cancelled order with 400 ORDER_IMMUTABLE", async () => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedTestOrder(store.id);

      const cancelPayload = {
        method: "POST",
        headers: {
          cookie: user.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "First cancel" }),
      };

      // First cancel succeeds
      const res1 = await cancelOrder(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/orders/${order.id}/cancel`,
          cancelPayload,
        ),
        { params: Promise.resolve({ storeId: store.id, orderId: order.id }) },
      );
      expect(res1.status).toBe(200);

      // Second cancel rejected
      const res2 = await cancelOrder(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/orders/${order.id}/cancel`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ reason: "Duplicate cancel attempt" }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, orderId: order.id }) },
      );
      expect(res2.status).toBe(400);

      const json2 = await res2.json();
      expect(json2.success).toBe(false);
      expect(json2.error.code).toBe("ORDER_IMMUTABLE");
    });

    it("forbids cancellation of orders in SHIPPED status", async () => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedTestOrder(store.id, { status: "SHIPPED" });

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/orders/${order.id}/cancel`,
        {
          method: "POST",
          headers: {
            cookie: user.cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({ reason: "Too late to cancel" }),
        },
      );

      const res = await cancelOrder(req, {
        params: Promise.resolve({ storeId: store.id, orderId: order.id }),
      });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("ORDER_CANCELLATION_ERROR");
    });

    it("strictly prevents public client from altering paymentStatus or forging authorizedInternalCall", async () => {
      const { user, store } = await createStoreWithOwner();
      const order = await seedTestOrder(store.id);

      // Client attempts malicious injection in cancel body
      const maliciousPayload = {
        reason: "Valid cancellation reason",
        paymentStatus: "PAID",
        authorizedInternalCall: true,
      };

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/orders/${order.id}/cancel`,
        {
          method: "POST",
          headers: {
            cookie: user.cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify(maliciousPayload),
        },
      );

      const res = await cancelOrder(req, {
        params: Promise.resolve({ storeId: store.id, orderId: order.id }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      // Payment status MUST NOT have changed to PAID
      expect(json.data.paymentStatus).toBe("PENDING");

      // Verify in database directly
      const dbRes = await db.query(
        `SELECT payment_status FROM orders WHERE id = $1`,
        [order.id],
      );
      expect(dbRes.rows[0].payment_status).toBe("PENDING");
    });
  });
});
