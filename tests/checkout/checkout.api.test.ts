import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@shopify-clone/db";
import { serializeSessionCookie } from "@shopify-clone/auth";
import { StoreService } from "@shopify-clone/stores";
import { CartService } from "@shopify-clone/carts";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import { getOpenApiDocument } from "../../apps/web/src/lib/api/openapi.js";

import { POST as postCheckout } from "../../apps/web/app/api/v1/stores/[storeId]/checkouts/route.js";
import {
  GET as getCheckout,
  PATCH as patchCheckout,
} from "../../apps/web/app/api/v1/stores/[storeId]/checkouts/[checkoutId]/route.js";
import { POST as cancelCheckout } from "../../apps/web/app/api/v1/stores/[storeId]/checkouts/[checkoutId]/cancel/route.js";

declare global {
  var __shopify_clone_web_db: unknown;
}

describe("Checkout API Endpoints (/api/v1/stores/[storeId]/checkouts/*)", { timeout: 45_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();
  const cartService = new CartService();

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__shopify_clone_web_db = isolated.database;
  }, 45_000);

  afterEach(async () => {
    global.__shopify_clone_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  }, 45_000);

  async function createAuthenticatedUser(email: string) {
    const userId = generateUuidV7();
    const sessionId = generateUuidV7();

    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'User', 'scrypt:hash', 'ACTIVE')`,
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
      name: "Checkout Test Store",
      slug: `store-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    return { user, store };
  }

  async function seedProductAndVariant(
    storeId: string,
    params: { price?: number; status?: "ACTIVE" | "INACTIVE"; stock?: number } = {},
  ): Promise<{ productId: string; variantId: string }> {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const price = params.price ?? 2500;
    const status = params.status ?? "ACTIVE";
    const stock = params.stock ?? 100;

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Test Product', $3, 'ACTIVE')`,
      [productId, storeId, `prod-${productId}`],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, status)
       VALUES ($1, $2, $3, 'Default Variant', $4, $5, $6)`,
      [variantId, productId, storeId, `SKU-${variantId}`, price, status],
    );

    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, $4, 0)`,
      [generateUuidV7(), storeId, variantId, stock],
    );

    return { productId, variantId };
  }

  async function seedTestCustomer(storeId: string, email = "cust@test.com"): Promise<string> {
    const customerId = generateUuidV7();
    await db.query(
      `INSERT INTO customers (id, store_id, email, status)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      [customerId, storeId, email.trim().toLowerCase()],
    );
    return customerId;
  }

  async function createActiveCartWithItems(
    storeId: string,
    customerId?: string,
  ): Promise<{ cartId: string; variantId: string; price: number }> {
    const { variantId } = await seedProductAndVariant(storeId, { price: 3000 });
    const cart = await cartService.createCart(db, storeId, {
      customerId,
      currency: "USD",
    });
    await cartService.addItem(db, storeId, cart.id, {
      variantId,
      quantity: 2,
    });
    return { cartId: cart.id, variantId, price: 3000 };
  }

  // ===========================================================================
  // 1. Authentication
  // ===========================================================================
  describe("Authentication", () => {
    it("rejects unauthenticated checkout creation with 401 AUTHENTICATION_REQUIRED", async () => {
      const { store } = await createStoreWithOwner();
      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cartId: generateUuidV7() }),
      });

      const res = await postCheckout(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("rejects unauthenticated checkout retrieval with 401 AUTHENTICATION_REQUIRED", async () => {
      const { store } = await createStoreWithOwner();
      const checkoutId = generateUuidV7();
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}`,
        { method: "GET" },
      );

      const res = await getCheckout(req, {
        params: Promise.resolve({ storeId: store.id, checkoutId }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("rejects unauthenticated checkout update with 401 AUTHENTICATION_REQUIRED", async () => {
      const { store } = await createStoreWithOwner();
      const checkoutId = generateUuidV7();
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "new@example.com" }),
        },
      );

      const res = await patchCheckout(req, {
        params: Promise.resolve({ storeId: store.id, checkoutId }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("rejects unauthenticated checkout cancellation with 401 AUTHENTICATION_REQUIRED", async () => {
      const { store } = await createStoreWithOwner();
      const checkoutId = generateUuidV7();
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}/cancel`,
        { method: "POST" },
      );

      const res = await cancelCheckout(req, {
        params: Promise.resolve({ storeId: store.id, checkoutId }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });
  });

  // ===========================================================================
  // 2. Authorization
  // ===========================================================================
  describe("Authorization", () => {
    it("returns 404 NOT_FOUND when accessed by user with no membership in the store", async () => {
      const { store } = await createStoreWithOwner("owner@test.com");
      const stranger = await createAuthenticatedUser("stranger@other.com");

      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: stranger.cookie,
        },
        body: JSON.stringify({ cartId: generateUuidV7() }),
      });

      const res = await postCheckout(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("allows staff member to read checkout, but rejects mutations with 403 FORBIDDEN", async () => {
      const { user: owner, store } = await createStoreWithOwner("owner@test.com");
      const staff = await createAuthenticatedUser("staff@test.com");

      await storeService.addStoreMember(db, store.id, owner.userId, {
        userId: staff.userId,
        role: "staff",
      });

      const { cartId } = await createActiveCartWithItems(store.id);

      // 1. Staff creates checkout -> 403 Forbidden
      const createReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: staff.cookie,
        },
        body: JSON.stringify({ cartId }),
      });
      const createRes = await postCheckout(createReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(createRes.status).toBe(403);
      const createBody = await createRes.json();
      expect(createBody.error.code).toBe("FORBIDDEN");

      // 2. Owner creates checkout -> 201 Created
      const ownerReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: owner.cookie,
        },
        body: JSON.stringify({ cartId }),
      });
      const ownerRes = await postCheckout(ownerReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(ownerRes.status).toBe(201);
      const ownerBody = await ownerRes.json();
      const checkoutId = ownerBody.data.id;

      // 3. Staff reads checkout -> 200 OK
      const getReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}`,
        {
          method: "GET",
          headers: { cookie: staff.cookie },
        },
      );
      const getRes = await getCheckout(getReq, {
        params: Promise.resolve({ storeId: store.id, checkoutId }),
      });
      expect(getRes.status).toBe(200);

      // 4. Staff updates checkout -> 403 Forbidden
      const patchReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: staff.cookie,
          },
          body: JSON.stringify({ email: "staff_update@test.com" }),
        },
      );
      const patchRes = await patchCheckout(patchReq, {
        params: Promise.resolve({ storeId: store.id, checkoutId }),
      });
      expect(patchRes.status).toBe(403);

      // 5. Staff cancels checkout -> 403 Forbidden
      const cancelReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}/cancel`,
        {
          method: "POST",
          headers: { cookie: staff.cookie },
        },
      );
      const cancelRes = await cancelCheckout(cancelReq, {
        params: Promise.resolve({ storeId: store.id, checkoutId }),
      });
      expect(cancelRes.status).toBe(403);
    });
  });

  // ===========================================================================
  // 3. Creation
  // ===========================================================================
  describe("Creation", () => {
    it("creates a checkout from active cart preserving items and initial totals", async () => {
      const { user, store } = await createStoreWithOwner();
      const { cartId, price } = await createActiveCartWithItems(store.id);

      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: user.cookie,
        },
        body: JSON.stringify({
          cartId,
          email: "customer@domain.com",
          shippingAddress: {
            addressLine1: "123 Main St",
            city: "New York",
            postalCode: "10001",
            country: "US",
          },
        }),
      });

      const res = await postCheckout(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.storeId).toBe(store.id);
      expect(json.data.cartId).toBe(cartId);
      expect(json.data.status).toBe("OPEN");
      expect(json.data.email).toBe("customer@domain.com");
      expect(json.data.subtotal).toBe(price * 2);
      expect(json.data.total).toBe(price * 2);
      expect(json.data.shippingAddress.addressLine1).toBe("123 Main St");
      expect(json.data.items).toHaveLength(1);
      expect(json.data.items[0].quantity).toBe(2);
    });

    it("rejects creation when cartId is missing or invalid UUID", async () => {
      const { user, store } = await createStoreWithOwner();

      // Missing cartId
      const req1 = new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: user.cookie,
        },
        body: JSON.stringify({ email: "test@example.com" }),
      });
      const res1 = await postCheckout(req1, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res1.status).toBe(400);
      const json1 = await res1.json();
      expect(json1.error.code).toBe("VALIDATION_ERROR");
      expect(json1.error.fields.cartId).toBeDefined();

      // Invalid UUID
      const req2 = new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: user.cookie,
        },
        body: JSON.stringify({ cartId: "not-a-uuid" }),
      });
      const res2 = await postCheckout(req2, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res2.status).toBe(400);
    });

    it("rejects creation from non-existent cart with 404 CART_NOT_FOUND", async () => {
      const { user, store } = await createStoreWithOwner();
      const fakeCartId = generateUuidV7();

      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: user.cookie,
        },
        body: JSON.stringify({ cartId: fakeCartId }),
      });
      const res = await postCheckout(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("CART_NOT_FOUND");
    });

    it("rejects creation from cross-store cart with 400 CROSS_STORE_CART", async () => {
      const { user: userA, store: storeA } = await createStoreWithOwner("ownerA@test.com");
      const { store: storeB } = await createStoreWithOwner("ownerB@test.com");

      const { cartId: cartB } = await createActiveCartWithItems(storeB.id);

      const req = new Request(`http://localhost:3000/api/v1/stores/${storeA.id}/checkouts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: userA.cookie,
        },
        body: JSON.stringify({ cartId: cartB }),
      });
      const res = await postCheckout(req, {
        params: Promise.resolve({ storeId: storeA.id }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("CROSS_STORE_CART");
    });

    it("rejects creation from empty cart with 400 EMPTY_CART", async () => {
      const { user, store } = await createStoreWithOwner();
      const emptyCart = await cartService.createCart(db, store.id, { currency: "USD" });

      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: user.cookie,
        },
        body: JSON.stringify({ cartId: emptyCart.id }),
      });
      const res = await postCheckout(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("EMPTY_CART");
    });

    it("handles Idempotency-Key: repeated calls return original result; conflicting payload returns 409", async () => {
      const { user, store } = await createStoreWithOwner();
      const { cartId } = await createActiveCartWithItems(store.id);
      const idempotencyKey = `idem-${generateUuidV7()}`;

      const payload1 = {
        cartId,
        email: "idem@test.com",
        shippingAddress: {
          addressLine1: "100 Broadway",
          city: "New York",
          postalCode: "10001",
          country: "US",
        },
      };

      // Call 1
      const req1 = new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: user.cookie,
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(payload1),
      });
      const res1 = await postCheckout(req1, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res1.status).toBe(201);
      const json1 = await res1.json();
      const originalCheckoutId = json1.data.id;

      // Call 2 with identical key and payload -> returns exact same checkout
      const req2 = new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: user.cookie,
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(payload1),
      });
      const res2 = await postCheckout(req2, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res2.status).toBe(201);
      const json2 = await res2.json();
      expect(json2.data.id).toBe(originalCheckoutId);

      // Call 3 with same key but different payload -> 409 IDEMPOTENCY_CONFLICT
      const payloadConflict = {
        cartId,
        email: "different_email@test.com",
        shippingAddress: {
          addressLine1: "999 Other St",
          city: "Boston",
          postalCode: "02108",
          country: "US",
        },
      };
      const req3 = new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: user.cookie,
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(payloadConflict),
      });
      const res3 = await postCheckout(req3, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res3.status).toBe(409);
      const json3 = await res3.json();
      expect(json3.error.code).toBe("IDEMPOTENCY_CONFLICT");
    });
  });

  // ===========================================================================
  // 4. Retrieval
  // ===========================================================================
  describe("Retrieval", () => {
    it("retrieves an existing checkout by ID with full details", async () => {
      const { user, store } = await createStoreWithOwner();
      const { cartId } = await createActiveCartWithItems(store.id);

      const createReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: user.cookie,
        },
        body: JSON.stringify({ cartId }),
      });
      const createRes = await postCheckout(createReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const checkoutId = (await createRes.json()).data.id;

      const getReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}`,
        {
          method: "GET",
          headers: { cookie: user.cookie },
        },
      );
      const getRes = await getCheckout(getReq, {
        params: Promise.resolve({ storeId: store.id, checkoutId }),
      });
      expect(getRes.status).toBe(200);
      const json = await getRes.json();
      expect(json.data.id).toBe(checkoutId);
      expect(json.data.items).toBeDefined();
    });

    it("returns 404 CHECKOUT_NOT_FOUND for non-existent checkout ID", async () => {
      const { user, store } = await createStoreWithOwner();
      const fakeCheckoutId = generateUuidV7();

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/checkouts/${fakeCheckoutId}`,
        {
          method: "GET",
          headers: { cookie: user.cookie },
        },
      );
      const res = await getCheckout(req, {
        params: Promise.resolve({ storeId: store.id, checkoutId: fakeCheckoutId }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("CHECKOUT_NOT_FOUND");
    });

    it("returns 404 when querying Store A checkout via Store B context (tenant isolation)", async () => {
      const { user: userA, store: storeA } = await createStoreWithOwner("ownerA@test.com");
      const { user: userB, store: storeB } = await createStoreWithOwner("ownerB@test.com");

      const { cartId } = await createActiveCartWithItems(storeA.id);
      const createReq = new Request(`http://localhost:3000/api/v1/stores/${storeA.id}/checkouts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: userA.cookie,
        },
        body: JSON.stringify({ cartId }),
      });
      const checkoutId = (await (await postCheckout(createReq, {
        params: Promise.resolve({ storeId: storeA.id }),
      })).json()).data.id;

      // User B attempts to access Checkout A using Store B path
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${storeB.id}/checkouts/${checkoutId}`,
        {
          method: "GET",
          headers: { cookie: userB.cookie },
        },
      );
      const res = await getCheckout(req, {
        params: Promise.resolve({ storeId: storeB.id, checkoutId }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("CHECKOUT_NOT_FOUND");
    });

    it("returns 400 VALIDATION_ERROR on malformed checkoutId or storeId", async () => {
      const { user, store } = await createStoreWithOwner();

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/checkouts/not-valid-uuid`,
        {
          method: "GET",
          headers: { cookie: user.cookie },
        },
      );
      const res = await getCheckout(req, {
        params: Promise.resolve({ storeId: store.id, checkoutId: "not-valid-uuid" }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ===========================================================================
  // 5. Updates (PATCH)
  // ===========================================================================
  describe("Updates (PATCH)", () => {
    it("updates customer, addresses, and totals on active checkout", async () => {
      const { user, store } = await createStoreWithOwner();
      const { cartId } = await createActiveCartWithItems(store.id);

      const createRes = await postCheckout(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({ cartId }),
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const checkoutId = (await createRes.json()).data.id;

      const customerId = await seedTestCustomer(store.id, "updated@domain.com");

      const patchReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({
            customerId,
            email: "updated@domain.com",
            shippingAddress: {
              addressLine1: "456 Oak Ave",
              city: "San Francisco",
              postalCode: "94102",
              country: "US",
            },
            discountTotal: 500,
            taxTotal: 300,
            shippingTotal: 700,
          }),
        },
      );
      const patchRes = await patchCheckout(patchReq, {
        params: Promise.resolve({ storeId: store.id, checkoutId }),
      });
      expect(patchRes.status).toBe(200);
      const json = await patchRes.json();
      expect(json.data.customerId).toBe(customerId);
      expect(json.data.email).toBe("updated@domain.com");
      expect(json.data.shippingAddress.addressLine1).toBe("456 Oak Ave");
      expect(json.data.discountTotal).toBe(500);
      expect(json.data.taxTotal).toBe(300);
      expect(json.data.shippingTotal).toBe(700);
      expect(json.data.total).toBe(6000 - 500 + 300 + 700);
    });

    it("supports item mutations via PATCH itemAction", async () => {
      const { user, store } = await createStoreWithOwner();
      const { cartId, variantId } = await createActiveCartWithItems(store.id);
      const { variantId: extraVariant } = await seedProductAndVariant(store.id, { price: 1500 });

      const createRes = await postCheckout(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({ cartId }),
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const checkoutId = (await createRes.json()).data.id;

      // 1. Add extra variant
      const addRes = await patchCheckout(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({
            itemAction: {
              action: "add",
              variantId: extraVariant,
              quantity: 1,
            },
          }),
        }),
        { params: Promise.resolve({ storeId: store.id, checkoutId }) },
      );
      expect(addRes.status).toBe(200);
      const addJson = await addRes.json();
      expect(addJson.data.items).toHaveLength(2);

      // 2. Update quantity
      const updateRes = await patchCheckout(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({
            itemAction: {
              action: "update",
              variantId: extraVariant,
              quantity: 3,
            },
          }),
        }),
        { params: Promise.resolve({ storeId: store.id, checkoutId }) },
      );
      expect(updateRes.status).toBe(200);
      const updateJson = await updateRes.json();
      const updatedItem = updateJson.data.items.find((i: { variantId: string }) => i.variantId === extraVariant);
      expect(updatedItem.quantity).toBe(3);

      // 3. Remove variant
      const removeRes = await patchCheckout(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({
            itemAction: {
              action: "remove",
              variantId,
            },
          }),
        }),
        { params: Promise.resolve({ storeId: store.id, checkoutId }) },
      );
      expect(removeRes.status).toBe(200);
      const removeJson = await removeRes.json();
      expect(removeJson.data.items).toHaveLength(1);
    });

    it("rejects direct status mutation via PATCH with 400 VALIDATION_ERROR", async () => {
      const { user, store } = await createStoreWithOwner();
      const { cartId } = await createActiveCartWithItems(store.id);

      const createRes = await postCheckout(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({ cartId }),
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const checkoutId = (await createRes.json()).data.id;

      const patchReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({ status: "COMPLETED" }),
        },
      );
      const patchRes = await patchCheckout(patchReq, {
        params: Promise.resolve({ storeId: store.id, checkoutId }),
      });
      expect(patchRes.status).toBe(400);
      const json = await patchRes.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.fields.status).toContain("Status cannot be updated directly");
    });

    it("rejects PATCH with empty body or no valid update fields with 400 VALIDATION_ERROR", async () => {
      const { user, store } = await createStoreWithOwner();
      const checkoutId = generateUuidV7();

      const patchReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({}),
        },
      );
      const patchRes = await patchCheckout(patchReq, {
        params: Promise.resolve({ storeId: store.id, checkoutId }),
      });
      expect(patchRes.status).toBe(400);
      const json = await patchRes.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects PATCH on terminal cancelled checkout with 400 CHECKOUT_TERMINAL", async () => {
      const { user, store } = await createStoreWithOwner();
      const { cartId } = await createActiveCartWithItems(store.id);

      const createRes = await postCheckout(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({ cartId }),
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const checkoutId = (await createRes.json()).data.id;

      // Cancel it
      await cancelCheckout(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}/cancel`, {
          method: "POST",
          headers: { cookie: user.cookie },
        }),
        { params: Promise.resolve({ storeId: store.id, checkoutId }) },
      );

      // Attempt update
      const patchRes = await patchCheckout(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({ email: "after_cancel@test.com" }),
        }),
        { params: Promise.resolve({ storeId: store.id, checkoutId }) },
      );
      expect(patchRes.status).toBe(400);
      const json = await patchRes.json();
      expect(json.error.code).toBe("CHECKOUT_NOT_EDITABLE");
    });

    it("rejects PATCH on checkout belonging to another store with 404 CHECKOUT_NOT_FOUND", async () => {
      const { user: userA, store: storeA } = await createStoreWithOwner("ownerA@test.com");
      const { user: userB, store: storeB } = await createStoreWithOwner("ownerB@test.com");
      const { cartId } = await createActiveCartWithItems(storeA.id);

      const createRes = await postCheckout(
        new Request(`http://localhost:3000/api/v1/stores/${storeA.id}/checkouts`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: userA.cookie,
          },
          body: JSON.stringify({ cartId }),
        }),
        { params: Promise.resolve({ storeId: storeA.id }) },
      );
      const checkoutId = (await createRes.json()).data.id;

      // Store B owner attempts to PATCH Store A's checkout
      const patchRes = await patchCheckout(
        new Request(`http://localhost:3000/api/v1/stores/${storeB.id}/checkouts/${checkoutId}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: userB.cookie,
          },
          body: JSON.stringify({ email: "hack@attack.com" }),
        }),
        { params: Promise.resolve({ storeId: storeB.id, checkoutId }) },
      );
      expect(patchRes.status).toBe(404);
      const json = await patchRes.json();
      expect(json.error.code).toBe("CHECKOUT_NOT_FOUND");
    });

    it("rejects attempts to tamper with paymentStatus via PATCH with 400 VALIDATION_ERROR", async () => {
      const { user, store } = await createStoreWithOwner();
      const { cartId } = await createActiveCartWithItems(store.id);

      const createRes = await postCheckout(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({ cartId }),
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const checkoutId = (await createRes.json()).data.id;

      const patchReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({ paymentStatus: "PAID" }),
        },
      );
      const patchRes = await patchCheckout(patchReq, {
        params: Promise.resolve({ storeId: store.id, checkoutId }),
      });
      expect(patchRes.status).toBe(400);
      const json = await patchRes.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.fields.paymentStatus).toContain("Payment status cannot be updated directly");
    });

    it("ensures PATCH is transactionally atomic: rolls back customer/totals updates if item mutation fails", async () => {
      const { user, store } = await createStoreWithOwner();
      const { cartId } = await createActiveCartWithItems(store.id);

      const createRes = await postCheckout(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({ cartId }),
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const originalCheckout = (await createRes.json()).data;
      const checkoutId = originalCheckout.id;

      // Attempt PATCH with valid email update BUT invalid itemAction referencing non-existent variant UUID
      const nonExistentVariant = generateUuidV7();
      const patchReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({
            email: "rollback-me@test.com",
            itemAction: {
              action: "add",
              variantId: nonExistentVariant,
              quantity: 1,
            },
          }),
        },
      );

      const patchRes = await patchCheckout(patchReq, {
        params: Promise.resolve({ storeId: store.id, checkoutId }),
      });
      expect(patchRes.status).toBe(404);

      // Fetch checkout and verify that email was NOT updated due to atomic rollback
      const getReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}`,
        {
          method: "GET",
          headers: { cookie: user.cookie },
        },
      );
      const getRes = await getCheckout(getReq, {
        params: Promise.resolve({ storeId: store.id, checkoutId }),
      });
      const current = (await getRes.json()).data;
      expect(current.email).toBe(originalCheckout.email);
    });
  });

  // ===========================================================================
  // 6. Cancellation
  // ===========================================================================
  describe("Cancellation", () => {
    it("cancels an active checkout successfully and idempotently", async () => {
      const { user, store } = await createStoreWithOwner();
      const { cartId } = await createActiveCartWithItems(store.id);

      const createRes = await postCheckout(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: user.cookie,
          },
          body: JSON.stringify({ cartId }),
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const checkoutId = (await createRes.json()).data.id;

      // First cancellation
      const cancelReq1 = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}/cancel`,
        {
          method: "POST",
          headers: { cookie: user.cookie },
        },
      );
      const cancelRes1 = await cancelCheckout(cancelReq1, {
        params: Promise.resolve({ storeId: store.id, checkoutId }),
      });
      expect(cancelRes1.status).toBe(200);
      const json1 = await cancelRes1.json();
      expect(json1.data.status).toBe("CANCELLED");

      // Repeated cancellation (idempotent)
      const cancelReq2 = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/checkouts/${checkoutId}/cancel`,
        {
          method: "POST",
          headers: { cookie: user.cookie },
        },
      );
      const cancelRes2 = await cancelCheckout(cancelReq2, {
        params: Promise.resolve({ storeId: store.id, checkoutId }),
      });
      expect(cancelRes2.status).toBe(200);
      const json2 = await cancelRes2.json();
      expect(json2.data.status).toBe("CANCELLED");
    });

    it("rejects cancellation of cross-store checkout with 404 CHECKOUT_NOT_FOUND", async () => {
      const { user: userA, store: storeA } = await createStoreWithOwner("ownerA@test.com");
      const { user: userB, store: storeB } = await createStoreWithOwner("ownerB@test.com");
      const { cartId } = await createActiveCartWithItems(storeA.id);

      const createRes = await postCheckout(
        new Request(`http://localhost:3000/api/v1/stores/${storeA.id}/checkouts`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: userA.cookie,
          },
          body: JSON.stringify({ cartId }),
        }),
        { params: Promise.resolve({ storeId: storeA.id }) },
      );
      const checkoutId = (await createRes.json()).data.id;

      const cancelReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeB.id}/checkouts/${checkoutId}/cancel`,
        {
          method: "POST",
          headers: { cookie: userB.cookie },
        },
      );
      const cancelRes = await cancelCheckout(cancelReq, {
        params: Promise.resolve({ storeId: storeB.id, checkoutId }),
      });
      expect(cancelRes.status).toBe(404);
      const json = await cancelRes.json();
      expect(json.error.code).toBe("CHECKOUT_NOT_FOUND");
    });
  });

  // ===========================================================================
  // 7. Error Mapping & Security
  // ===========================================================================
  describe("Error Mapping & Security", () => {
    it("ensures no internal SQL details, connection errors, or stack traces leak in API error responses", async () => {
      const { user, store } = await createStoreWithOwner();

      // Trigger a validation failure
      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/checkouts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: user.cookie,
        },
        body: JSON.stringify({ cartId: "malformed" }),
      });
      const res = await postCheckout(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const body = await res.json();

      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBeDefined();

      const rawString = JSON.stringify(body);
      expect(rawString).not.toContain("SELECT ");
      expect(rawString).not.toContain("INSERT INTO");
      expect(rawString).not.toContain("stack");
      expect(rawString).not.toContain("at async");
    });
  });

  // ===========================================================================
  // 8. OpenAPI Contract Consistency
  // ===========================================================================
  describe("OpenAPI Contract", () => {
    it("contains canonical checkout paths and schemas, without stale or arbitrary status endpoints", () => {
      const doc = getOpenApiDocument() as {
        components: { schemas: Record<string, unknown> };
        paths: Record<string, Record<string, unknown>>;
      };

      // Check schemas
      expect(doc.components.schemas.Checkout).toBeDefined();
      expect(doc.components.schemas.CheckoutItem).toBeDefined();
      expect(doc.components.schemas.CheckoutAddress).toBeDefined();
      expect(doc.components.schemas.CreateCheckoutRequest).toBeDefined();
      expect(doc.components.schemas.UpdateCheckoutRequest).toBeDefined();

      // Check paths
      expect(doc.paths["/stores/{storeId}/checkouts"]).toBeDefined();
      expect(doc.paths["/stores/{storeId}/checkouts"].post).toBeDefined();

      expect(doc.paths["/stores/{storeId}/checkouts/{checkoutId}"]).toBeDefined();
      expect(doc.paths["/stores/{storeId}/checkouts/{checkoutId}"].get).toBeDefined();
      expect(doc.paths["/stores/{storeId}/checkouts/{checkoutId}"].patch).toBeDefined();

      expect(doc.paths["/stores/{storeId}/checkouts/{checkoutId}/cancel"]).toBeDefined();
      expect(doc.paths["/stores/{storeId}/checkouts/{checkoutId}/cancel"].post).toBeDefined();

      // Ensure forbidden arbitrary transition or status routes are NOT present
      expect(doc.paths["/stores/{storeId}/checkouts/{checkoutId}/status"]).toBeUndefined();
      expect(doc.paths["/stores/{storeId}/checkouts/{checkoutId}/complete"]).toBeUndefined();
      expect(doc.paths["/stores/{storeId}/checkouts/{checkoutId}/transition"]).toBeUndefined();
    });
  });
});
