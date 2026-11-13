import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@calcart/db";
import { serializeSessionCookie } from "@calcart/auth";
import { StoreService } from "@calcart/stores";
import { OrderStatusService } from "@calcart/orders";
import { ReturnService } from "@calcart/returns";
import { createIsolatedDatabase } from "../helpers/postgres.js";

import { GET as listReturns } from "../../apps/web/app/api/v1/stores/[storeId]/returns/route.js";
import { GET as getReturn } from "../../apps/web/app/api/v1/stores/[storeId]/returns/[returnId]/route.js";
import { POST as approveReturn } from "../../apps/web/app/api/v1/stores/[storeId]/returns/[returnId]/approve/route.js";
import { POST as refundReturn } from "../../apps/web/app/api/v1/stores/[storeId]/returns/[returnId]/refund/route.js";
import {
  GET as getPolicy,
  PATCH as patchPolicy,
} from "../../apps/web/app/api/v1/stores/[storeId]/returns/policy/route.js";

declare global {
  var __calcart_web_db: unknown;
}

describe("Returns API Endpoints", { timeout: 600_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();
  const returnService = new ReturnService();

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
      `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
      [sessionId, userId, expiresAt],
    );
    return {
      userId,
      cookie: serializeSessionCookie(sessionId, { expires: expiresAt }),
    };
  }

  async function createStoreWithOwner(email: string) {
    const user = await createAuthenticatedUser(email);
    const store = await storeService.createStore(db, user.userId, {
      name: "Returns Test Store",
      slug: `store-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      currency: "INR",
      locale: "en-IN",
      timezone: "Asia/Kolkata",
    });
    return { user, store };
  }

  async function addMember(
    storeId: string,
    email: string,
    role: "admin" | "staff",
  ) {
    const user = await createAuthenticatedUser(email);
    await db.query(
      `INSERT INTO store_memberships (id, store_id, user_id, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE', NOW(), NOW())`,
      [generateUuidV7(), storeId, user.userId, role],
    );
    return user;
  }

  /** Seeds a paid, fulfilled order with one line and a captured payment. */
  async function seedFulfilledOrder(storeId: string) {
    const customerId = generateUuidV7();
    const cartId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const orderId = generateUuidV7();
    const itemId = generateUuidV7();
    const paymentId = generateUuidV7();
    const amount = 5000;

    await db.query(
      `INSERT INTO customers (id, store_id, email, first_name, last_name)
       VALUES ($1, $2, 'buyer@example.com', 'Alex', 'Buyer')`,
      [customerId, storeId],
    );
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, customer_id, status, currency, total)
       VALUES ($1, $2, $3, $4, 'COMPLETED', 'INR', $5)`,
      [checkoutId, storeId, cartId, customerId, amount],
    );
    await db.query(
      `INSERT INTO orders (
         id, store_id, customer_id, checkout_id, order_number, status, payment_status,
         fulfillment_status, currency, subtotal, total, grand_total
       ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED', 'PAID', 'UNFULFILLED', 'INR', $6, $6, $6)`,
      [orderId, storeId, customerId, checkoutId, `ORD-${orderId.slice(0, 8)}`, amount],
    );
    await db.query(
      `INSERT INTO order_items (
         id, order_id, store_id, product_name_snapshot, variant_name_snapshot,
         sku_snapshot, quantity, unit_price, line_total
       ) VALUES ($1, $2, $3, 'Silk Scarf', 'Ruby Red', 'SKU-1', 1, $4, $4)`,
      [itemId, orderId, storeId, amount],
    );
    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, order_id, amount, currency, status, provider,
         captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, $4, $5, 'INR', 'CAPTURED', 'razorpay', $5, 0)`,
      [paymentId, storeId, checkoutId, orderId, amount],
    );

    await new OrderStatusService().updateFulfillmentStatus(db, {
      storeId,
      orderId,
      fulfillmentStatus: "FULFILLED",
      actorType: "MERCHANT",
    });

    return { orderId, itemId, customerId, amount };
  }

  async function seedReturn(storeId: string, orderId: string, itemId: string) {
    return returnService.createReturnRequest(db, {
      storeId,
      orderId,
      reason: "Damaged on arrival",
      items: [{ orderItemId: itemId, quantity: 1 }],
    });
  }

  function req(
    url: string,
    init?: { cookie?: string; method?: string; body?: unknown },
  ): Request {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (init?.cookie) headers.cookie = init.cookie;
    return new Request(url, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  }

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  it("rejects unauthenticated access to the merchant return queue", async () => {
    const { store } = await createStoreWithOwner("owner-unauth@test.com");

    const res = await listReturns(
      req(`https://app.test/api/v1/stores/${store.id}/returns`),
      { params: Promise.resolve({ storeId: store.id }) },
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects unauthenticated return approval", async () => {
    const { store } = await createStoreWithOwner("owner-unauth2@test.com");
    const order = await seedFulfilledOrder(store.id);
    const ret = await seedReturn(store.id, order.orderId, order.itemId);

    const res = await approveReturn(
      req(
        `https://app.test/api/v1/stores/${store.id}/returns/${ret.id}/approve`,
        { method: "POST", body: {} },
      ),
      { params: Promise.resolve({ storeId: store.id, returnId: ret.id }) },
    );

    expect(res.status).toBe(401);

    // The return is untouched.
    const unchanged = await returnService.getReturnRequest(
      db,
      store.id,
      ret.id,
    );
    expect(unchanged?.status).toBe("REQUESTED");
  });

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  it("hides another store's returns and refuses cross-store approval", async () => {
    const victim = await createStoreWithOwner("victim@test.com");
    const attacker = await createStoreWithOwner("attacker@test.com");
    const order = await seedFulfilledOrder(victim.store.id);
    const ret = await seedReturn(victim.store.id, order.orderId, order.itemId);

    // The attacker cannot list the victim's returns through their own store.
    const listRes = await listReturns(
      req(`https://app.test/api/v1/stores/${attacker.store.id}/returns`, {
        cookie: attacker.user.cookie,
      }),
      { params: Promise.resolve({ storeId: attacker.store.id }) },
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data.total).toBe(0);

    // Addressing the victim's store id is refused as a non-member.
    const crossList = await listReturns(
      req(`https://app.test/api/v1/stores/${victim.store.id}/returns`, {
        cookie: attacker.user.cookie,
      }),
      { params: Promise.resolve({ storeId: victim.store.id }) },
    );
    expect(crossList.status).toBe(404);

    // Reading the victim's return id through the attacker's own store 404s.
    const crossGet = await getReturn(
      req(
        `https://app.test/api/v1/stores/${attacker.store.id}/returns/${ret.id}`,
        { cookie: attacker.user.cookie },
      ),
      {
        params: Promise.resolve({
          storeId: attacker.store.id,
          returnId: ret.id,
        }),
      },
    );
    expect(crossGet.status).toBe(404);

    // And approving it is refused without mutating anything.
    const crossApprove = await approveReturn(
      req(
        `https://app.test/api/v1/stores/${attacker.store.id}/returns/${ret.id}/approve`,
        { method: "POST", cookie: attacker.user.cookie, body: {} },
      ),
      {
        params: Promise.resolve({
          storeId: attacker.store.id,
          returnId: ret.id,
        }),
      },
    );
    expect(crossApprove.status).toBe(404);

    const unchanged = await returnService.getReturnRequest(
      db,
      victim.store.id,
      ret.id,
    );
    expect(unchanged?.status).toBe("REQUESTED");
  });

  // -------------------------------------------------------------------------
  // Role gates
  // -------------------------------------------------------------------------

  it("lets staff approve a return but blocks staff from issuing the refund", async () => {
    const { store } = await createStoreWithOwner("owner-roles@test.com");
    const staff = await addMember(store.id, "staff-roles@test.com", "staff");
    const order = await seedFulfilledOrder(store.id);
    const ret = await seedReturn(store.id, order.orderId, order.itemId);

    // Staff may approve.
    const approveRes = await approveReturn(
      req(
        `https://app.test/api/v1/stores/${store.id}/returns/${ret.id}/approve`,
        { method: "POST", cookie: staff.cookie, body: {} },
      ),
      { params: Promise.resolve({ storeId: store.id, returnId: ret.id }) },
    );
    expect(approveRes.status).toBe(200);

    await returnService.markReturnReceived(db, {
      storeId: store.id,
      returnRequestId: ret.id,
    });

    // Staff may not refund.
    const refundRes = await refundReturn(
      req(
        `https://app.test/api/v1/stores/${store.id}/returns/${ret.id}/refund`,
        { method: "POST", cookie: staff.cookie },
      ),
      { params: Promise.resolve({ storeId: store.id, returnId: ret.id }) },
    );
    expect(refundRes.status).toBe(403);
    const refundBody = await refundRes.json();
    expect(refundBody.error.code).toBe("FORBIDDEN");

    // No refund row was created.
    const refunds = await db.query(
      `SELECT COUNT(*)::int AS c FROM refunds WHERE order_id = $1`,
      [order.orderId],
    );
    expect(refunds.rows[0].c).toBe(0);
  });

  it("blocks staff from changing the return policy but allows admin", async () => {
    const { store } = await createStoreWithOwner("owner-policy@test.com");
    const staff = await addMember(store.id, "staff-policy@test.com", "staff");
    const admin = await addMember(store.id, "admin-policy@test.com", "admin");

    const staffPatch = await patchPolicy(
      req(`https://app.test/api/v1/stores/${store.id}/returns/policy`, {
        method: "PATCH",
        cookie: staff.cookie,
        body: { returnWindowDays: 60 },
      }),
      { params: Promise.resolve({ storeId: store.id }) },
    );
    expect(staffPatch.status).toBe(403);

    const adminPatch = await patchPolicy(
      req(`https://app.test/api/v1/stores/${store.id}/returns/policy`, {
        method: "PATCH",
        cookie: admin.cookie,
        body: { returnWindowDays: 60 },
      }),
      { params: Promise.resolve({ storeId: store.id }) },
    );
    expect(adminPatch.status).toBe(200);
    const adminBody = await adminPatch.json();
    expect(adminBody.data.returnWindowDays).toBe(60);

    // Staff can still read it.
    const read = await getPolicy(
      req(`https://app.test/api/v1/stores/${store.id}/returns/policy`, {
        cookie: staff.cookie,
      }),
      { params: Promise.resolve({ storeId: store.id }) },
    );
    expect(read.status).toBe(200);
    const readBody = await read.json();
    expect(readBody.data.returnWindowDays).toBe(60);
    expect(readBody.data.isDefault).toBe(false);
  });

  it("reports the default policy before any override is stored", async () => {
    const { store, user } = await createStoreWithOwner("owner-default@test.com");

    const res = await getPolicy(
      req(`https://app.test/api/v1/stores/${store.id}/returns/policy`, {
        cookie: user.cookie,
      }),
      { params: Promise.resolve({ storeId: store.id }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.isDefault).toBe(true);
    expect(body.data.returnWindowDays).toBe(14);
  });

  it("rejects an out-of-range return window", async () => {
    const { store, user } = await createStoreWithOwner("owner-range@test.com");

    for (const returnWindowDays of [-1, 400, 1.5]) {
      const res = await patchPolicy(
        req(`https://app.test/api/v1/stores/${store.id}/returns/policy`, {
          method: "PATCH",
          cookie: user.cookie,
          body: { returnWindowDays },
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      expect(res.status).toBe(400);
    }
  });

  // -------------------------------------------------------------------------
  // Queue behaviour
  // -------------------------------------------------------------------------

  it("filters the queue by status and validates the status parameter", async () => {
    const { store, user } = await createStoreWithOwner("owner-filter@test.com");
    const order = await seedFulfilledOrder(store.id);
    await seedReturn(store.id, order.orderId, order.itemId);

    const requested = await listReturns(
      req(
        `https://app.test/api/v1/stores/${store.id}/returns?status=REQUESTED`,
        { cookie: user.cookie },
      ),
      { params: Promise.resolve({ storeId: store.id }) },
    );
    expect(requested.status).toBe(200);
    expect((await requested.json()).data.total).toBe(1);

    const approved = await listReturns(
      req(
        `https://app.test/api/v1/stores/${store.id}/returns?status=APPROVED`,
        { cookie: user.cookie },
      ),
      { params: Promise.resolve({ storeId: store.id }) },
    );
    expect((await approved.json()).data.total).toBe(0);

    const bogus = await listReturns(
      req(`https://app.test/api/v1/stores/${store.id}/returns?status=NONSENSE`, {
        cookie: user.cookie,
      }),
      { params: Promise.resolve({ storeId: store.id }) },
    );
    expect(bogus.status).toBe(400);
  });

  it("refuses an invalid return status transition with a domain error code", async () => {
    const { store, user } = await createStoreWithOwner("owner-trans@test.com");
    const order = await seedFulfilledOrder(store.id);
    const ret = await seedReturn(store.id, order.orderId, order.itemId);

    // REQUESTED -> REFUNDED is not a legal jump.
    const res = await refundReturn(
      req(
        `https://app.test/api/v1/stores/${store.id}/returns/${ret.id}/refund`,
        { method: "POST", cookie: user.cookie },
      ),
      { params: Promise.resolve({ storeId: store.id, returnId: ret.id }) },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_RETURN_STATUS_TRANSITION");
  });
});
