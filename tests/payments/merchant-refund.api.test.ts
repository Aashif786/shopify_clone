import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@calcart/db";
import { serializeSessionCookie } from "@calcart/auth";
import { StoreService } from "@calcart/stores";
import { createIsolatedDatabase } from "../helpers/postgres.js";

import { POST as orderRefundPost, GET as orderRefundGet } from "../../apps/web/app/api/v1/stores/[storeId]/orders/[orderId]/refund/route.js";
import { POST as paymentRefundPost, GET as paymentRefundGet } from "../../apps/web/app/api/v1/stores/[storeId]/payments/[paymentId]/refunds/route.js";

declare global {
  var __calcart_web_db: unknown;
}

describe("Merchant Refund API Endpoints", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__calcart_web_db = isolated.database;
  });

  afterEach(async () => {
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
      name: "Refunds Test Store",
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

  async function seedOrderWithPayment(
    storeId: string,
    options?: {
      amount?: number;
      paymentStatus?: string;
      orderStatus?: string;
    },
  ) {
    const amount = options?.amount ?? 10000;
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );

    const checkoutId = generateUuidV7();
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, $4, 'PAYMENT_PENDING', 'PENDING', 'USD')`,
      [checkoutId, storeId, cartId, amount],
    );

    const orderId = generateUuidV7();
    const pmtStatus = options?.paymentStatus ?? "CAPTURED";
    const ordPmtStatus =
      pmtStatus === "REFUNDED"
        ? "REFUNDED"
        : pmtStatus === "CAPTURED"
        ? "PAID"
        : "PENDING";

    await db.query(
      `INSERT INTO orders (id, store_id, checkout_id, order_number, total, grand_total, currency, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $5, 'USD', $6, $7)`,
      [
        orderId,
        storeId,
        checkoutId,
        `ORD-${orderId.slice(0, 8)}`,
        amount,
        options?.orderStatus ?? "CONFIRMED",
        ordPmtStatus,
      ],
    );

    const paymentId = generateUuidV7();
    const captured = pmtStatus === "CAPTURED" || pmtStatus === "REFUNDED" ? amount : 0;
    const refunded = pmtStatus === "REFUNDED" ? amount : 0;

    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, order_id, amount, currency, status, provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, $4, $5, 'USD', $6, 'razorpay', $7, $8)`,
      [paymentId, storeId, checkoutId, orderId, amount, pmtStatus, captured, refunded],
    );

    return { orderId, paymentId, checkoutId };
  }

  describe("1. Order Refund Endpoint (/api/v1/stores/[storeId]/orders/[orderId]/refund)", () => {
    it("returns 401 when request is unauthenticated", async () => {
      const { store } = await createStoreWithOwner();
      const { orderId } = await seedOrderWithPayment(store.id);

      const req = new Request(
        `http://localhost/api/v1/stores/${store.id}/orders/${orderId}/refund`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Unauthenticated test" }),
        },
      );

      const res = await orderRefundPost(req, {
        params: Promise.resolve({ storeId: store.id, orderId }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 403 when caller is staff without admin role", async () => {
      const { store } = await createStoreWithOwner();
      const staff = await createStaffUser(store.id);
      const { orderId } = await seedOrderWithPayment(store.id);

      const req = new Request(
        `http://localhost/api/v1/stores/${store.id}/orders/${orderId}/refund`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: staff.cookie,
          },
          body: JSON.stringify({ reason: "Staff attempt" }),
        },
      );

      const res = await orderRefundPost(req, {
        params: Promise.resolve({ storeId: store.id, orderId }),
      });
      expect(res.status).toBe(403);
      const json = await res.json();

      expect(json.error.code).toBe("FORBIDDEN");
    });

    it("returns 400 when reason is missing or empty", async () => {
      const { user, store } = await createStoreWithOwner();
      const { orderId } = await seedOrderWithPayment(store.id);

      const req = new Request(
        `http://localhost/api/v1/stores/${store.id}/orders/${orderId}/refund`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: user.cookie,
          },
          body: JSON.stringify({ reason: "   " }),
        },
      );

      const res = await orderRefundPost(req, {
        params: Promise.resolve({ storeId: store.id, orderId }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();

      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when order is cancelled", async () => {
      const { user, store } = await createStoreWithOwner();
      const { orderId } = await seedOrderWithPayment(store.id, {
        orderStatus: "CANCELLED",
        paymentStatus: "CAPTURED",
      });

      const req = new Request(
        `http://localhost/api/v1/stores/${store.id}/orders/${orderId}/refund`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: user.cookie,
          },
          body: JSON.stringify({ reason: "Refund on cancelled order" }),
        },
      );

      const res = await orderRefundPost(req, {
        params: Promise.resolve({ storeId: store.id, orderId }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();

      expect(json.error.code).toBe("PAYMENT_NOT_REFUNDABLE");
    });

    it("successfully issues full refund when authorized and updates order status", async () => {
      const { user, store } = await createStoreWithOwner();
      const { orderId } = await seedOrderWithPayment(store.id, {
        amount: 8000,
        paymentStatus: "CAPTURED",
      });

      const req = new Request(
        `http://localhost/api/v1/stores/${store.id}/orders/${orderId}/refund`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: user.cookie,
          },
          body: JSON.stringify({ reason: "Customer return accepted" }),
        },
      );

      const res = await orderRefundPost(req, {
        params: Promise.resolve({ storeId: store.id, orderId }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.status).toBe("SUCCEEDED");
      expect(json.data.orderPaymentStatus).toBe("REFUNDED");
      expect(json.data.refund.amount).toBe(8000);

      // Verify order payment status is updated in database
      const orderDb = await db.query<{ payment_status: string }>(
        `SELECT payment_status FROM orders WHERE id = $1 AND store_id = $2`,
        [orderId, store.id],
      );
      expect(orderDb.rows[0]?.payment_status).toBe("REFUNDED");
    });

    it("GET refund summary returns financial status and previous refunds for staff", async () => {
      const { user, store } = await createStoreWithOwner();
      const staff = await createStaffUser(store.id);
      const { orderId } = await seedOrderWithPayment(store.id, {
        amount: 9500,
        paymentStatus: "CAPTURED",
      });

      // Issue refund first
      const postReq = new Request(
        `http://localhost/api/v1/stores/${store.id}/orders/${orderId}/refund`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: user.cookie,
          },
          body: JSON.stringify({ reason: "Staff view test refund" }),
        },
      );
      await orderRefundPost(postReq, {
        params: Promise.resolve({ storeId: store.id, orderId }),
      });

      // Staff calls GET
      const getReq = new Request(
        `http://localhost/api/v1/stores/${store.id}/orders/${orderId}/refund`,
        {
          method: "GET",
          headers: { Cookie: staff.cookie },
        },
      );
      const getRes = await orderRefundGet(getReq, {
        params: Promise.resolve({ storeId: store.id, orderId }),
      });
      expect(getRes.status).toBe(200);
      const json = await getRes.json();
      expect(json.success).toBe(true);
      expect(json.data.capturedAmount).toBe(9500);
      expect(json.data.refundedAmount).toBe(9500);
      expect(json.data.remainingRefundable).toBe(0);
      expect(json.data.isRefundable).toBe(false);
      expect(json.data.refunds.length).toBe(1);
      expect(json.data.refunds[0].amount).toBe(9500);
    });

    it("returns 404 when order does not exist in store", async () => {
      const { user, store } = await createStoreWithOwner("order-404@test.com");
      const nonExistentOrderId = generateUuidV7();

      const getReq = new Request(
        `http://localhost/api/v1/stores/${store.id}/orders/${nonExistentOrderId}/refund`,
        {
          method: "GET",
          headers: { Cookie: user.cookie },
        },
      );
      const getRes = await orderRefundGet(getReq, {
        params: Promise.resolve({ storeId: store.id, orderId: nonExistentOrderId }),
      });
      expect(getRes.status).toBe(404);
    });

    it("returns 403 when order belongs to a different store", async () => {
      const { user: userA, store: storeA } = await createStoreWithOwner("storeA@test.com");
      const { store: storeB } = await createStoreWithOwner("storeB@test.com");
      const { orderId } = await seedOrderWithPayment(storeB.id);

      const getReq = new Request(
        `http://localhost/api/v1/stores/${storeA.id}/orders/${orderId}/refund`,
        {
          method: "GET",
          headers: { Cookie: userA.cookie },
        },
      );
      const getRes = await orderRefundGet(getReq, {
        params: Promise.resolve({ storeId: storeA.id, orderId }),
      });
      expect(getRes.status).toBe(403);
    });
  });

  describe("2. Payment Refund Endpoint (/api/v1/stores/[storeId]/payments/[paymentId]/refunds)", () => {
    it("returns 400 when Idempotency-Key header is missing", async () => {
      const { user, store } = await createStoreWithOwner();
      const { paymentId } = await seedOrderWithPayment(store.id);

      const req = new Request(
        `http://localhost/api/v1/stores/${store.id}/payments/${paymentId}/refunds`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: user.cookie,
          },
          body: JSON.stringify({ reason: "No key provided" }),
        },
      );

      const res = await paymentRefundPost(req, {
        params: Promise.resolve({ storeId: store.id, paymentId }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();

      expect(json.error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    });

    it("successfully processes refund with Idempotency-Key header", async () => {
      const { user, store } = await createStoreWithOwner();
      const { paymentId } = await seedOrderWithPayment(store.id, {
        amount: 6000,
        paymentStatus: "CAPTURED",
      });

      const req = new Request(
        `http://localhost/api/v1/stores/${store.id}/payments/${paymentId}/refunds`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "spec-refund-key-001",
            Cookie: user.cookie,
          },
          body: JSON.stringify({ reason: "Spec test refund" }),
        },
      );

      const res = await paymentRefundPost(req, {
        params: Promise.resolve({ storeId: store.id, paymentId }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.amount).toBe(6000);
      expect(json.data.status).toBe("SUCCEEDED");
      expect(json.data.remainingRefundable).toBe(0);

      // GET returns refund list
      const getReq = new Request(
        `http://localhost/api/v1/stores/${store.id}/payments/${paymentId}/refunds`,
        {
          method: "GET",
          headers: { Cookie: user.cookie },
        },
      );
      const getRes = await paymentRefundGet(getReq, {
        params: Promise.resolve({ storeId: store.id, paymentId }),
      });
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.data.length).toBe(1);
      expect(getJson.data[0].amount).toBe(6000);
    });

    it("returns 404 when payment does not exist in store", async () => {
      const { user, store } = await createStoreWithOwner("owner-404@test.com");
      const nonExistentPaymentId = generateUuidV7();

      const getReq = new Request(
        `http://localhost/api/v1/stores/${store.id}/payments/${nonExistentPaymentId}/refunds`,
        {
          method: "GET",
          headers: { Cookie: user.cookie },
        },
      );
      const getRes = await paymentRefundGet(getReq, {
        params: Promise.resolve({ storeId: store.id, paymentId: nonExistentPaymentId }),
      });
      expect(getRes.status).toBe(404);
    });

    it("returns 403 when payment belongs to a different store", async () => {
      const { user: userA, store: storeA } = await createStoreWithOwner("ownerA2@test.com");
      const { store: storeB } = await createStoreWithOwner("ownerB2@test.com");
      const { paymentId } = await seedOrderWithPayment(storeB.id);

      const getReq = new Request(
        `http://localhost/api/v1/stores/${storeA.id}/payments/${paymentId}/refunds`,
        {
          method: "GET",
          headers: { Cookie: userA.cookie },
        },
      );
      const getRes = await paymentRefundGet(getReq, {
        params: Promise.resolve({ storeId: storeA.id, paymentId }),
      });
      expect(getRes.status).toBe(403);
    });
  });
});
