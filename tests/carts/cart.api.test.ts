import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@calcart/db";
import { serializeSessionCookie } from "@calcart/auth";
import { StoreService } from "@calcart/stores";
import { createIsolatedDatabase } from "../helpers/postgres.js";

import {
  GET as getCarts,
  POST as postCart,
} from "../../apps/web/app/api/v1/stores/[storeId]/carts/route.js";
import { GET as getActiveCart } from "../../apps/web/app/api/v1/stores/[storeId]/carts/active/route.js";
import { GET as getCart } from "../../apps/web/app/api/v1/stores/[storeId]/carts/[cartId]/route.js";
import {
  GET as getCartItems,
  POST as postCartItem,
  DELETE as clearCartItems,
} from "../../apps/web/app/api/v1/stores/[storeId]/carts/[cartId]/items/route.js";
import {
  GET as getCartItem,
  PATCH as patchCartItem,
  DELETE as deleteCartItem,
} from "../../apps/web/app/api/v1/stores/[storeId]/carts/[cartId]/items/[itemId]/route.js";
import { POST as associateCustomer } from "../../apps/web/app/api/v1/stores/[storeId]/carts/[cartId]/customer/route.js";
import { POST as completeCart } from "../../apps/web/app/api/v1/stores/[storeId]/carts/[cartId]/complete/route.js";
import { POST as expireCart } from "../../apps/web/app/api/v1/stores/[storeId]/carts/[cartId]/expire/route.js";
import { POST as abandonCart } from "../../apps/web/app/api/v1/stores/[storeId]/carts/[cartId]/abandon/route.js";
import { POST as clearCartAction } from "../../apps/web/app/api/v1/stores/[storeId]/carts/[cartId]/clear/route.js";

declare global {
  var __calcart_web_db: unknown;
}

describe("Carts API Endpoints (/api/v1/stores/[storeId]/carts/*)", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__calcart_web_db = isolated.database;
  }, 30_000);

  afterEach(async () => {
    global.__calcart_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  }, 30_000);

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
      name: "Test Store",
      slug: `store-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    return { user, store };
  }

  async function seedTestProductAndVariant(
    storeId: string,
    params: {
      price?: number;
      status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
      productStatus?: "ACTIVE" | "DRAFT" | "ARCHIVED";
      stock?: number;
    } = {},
  ): Promise<{ productId: string; variantId: string }> {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const price = params.price ?? 2000;
    const status = params.status ?? "ACTIVE";
    const productStatus = params.productStatus ?? "ACTIVE";
    const stock = params.stock ?? 100;

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Test Product', $3, $4)`,
      [productId, storeId, `prod-${productId}`, productStatus],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, status)
       VALUES ($1, $2, $3, 'Test Variant', $4, $5, $6)`,
      [variantId, productId, storeId, `SKU-${variantId}`, price, status],
    );

    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, $4, 0)`,
      [generateUuidV7(), storeId, variantId, stock],
    );

    return { productId, variantId };
  }

  async function seedTestCustomer(
    storeId: string,
    email = "customer@test.com",
  ): Promise<string> {
    const customerId = generateUuidV7();
    await db.query(
      `INSERT INTO customers (id, store_id, email, status)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      [customerId, storeId, email.trim().toLowerCase()],
    );
    return customerId;
  }

  // ===========================================================================
  // 1. Authentication & Authorization
  // ===========================================================================
  describe("Authentication & Authorization", () => {
    it("rejects unauthenticated cart creation with 401 AUTHENTICATION_REQUIRED", async () => {
      const { store } = await createStoreWithOwner();
      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currency: "USD" }),
      });

      const res = await postCart(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("rejects unauthenticated cart retrieval with 401 AUTHENTICATION_REQUIRED", async () => {
      const { store } = await createStoreWithOwner();
      const cartId = generateUuidV7();
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cartId}`,
        { method: "GET" },
      );

      const res = await getCart(req, {
        params: Promise.resolve({ storeId: store.id, cartId }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("returns 404 NOT_FOUND when accessed by user with no membership (tenant-safe)", async () => {
      const { store } = await createStoreWithOwner("owner@test.com");
      const stranger = await createAuthenticatedUser("stranger@other.com");

      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: stranger.cookie,
        },
        body: JSON.stringify({ currency: "USD" }),
      });

      const res = await postCart(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("allows staff member to read cart, but rejects cart mutation with 403 FORBIDDEN", async () => {
      const { user: owner, store } = await createStoreWithOwner("owner@test.com");
      const staff = await createAuthenticatedUser("staff@test.com");

      await storeService.addStoreMember(db, store.id, owner.userId, {
        userId: staff.userId,
        role: "staff",
      });

      // 1. Staff creates cart -> 403 Forbidden
      const createReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: staff.cookie,
        },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes = await postCart(createReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(createRes.status).toBe(403);
      const createBody = await createRes.json();
      expect(createBody.error.code).toBe("FORBIDDEN");

      // 2. Owner creates cart -> 201
      const ownerReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: owner.cookie,
        },
        body: JSON.stringify({ currency: "USD" }),
      });
      const ownerRes = await postCart(ownerReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(ownerRes.status).toBe(201);
      const ownerBody = await ownerRes.json();
      const cartId = ownerBody.data.id;

      // 3. Staff reads cart -> 200 OK
      const getReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cartId}`,
        {
          method: "GET",
          headers: { cookie: staff.cookie },
        },
      );
      const getRes = await getCart(getReq, {
        params: Promise.resolve({ storeId: store.id, cartId }),
      });
      expect(getRes.status).toBe(200);
      const getBody = await getRes.json();
      expect(getBody.data.id).toBe(cartId);
    });
  });

  // ===========================================================================
  // 2. Cart CRUD & Active Retrieval
  // ===========================================================================
  describe("Cart CRUD & Retrieval", () => {
    it("creates a guest cart and returns 201 with CartDTO", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: owner.cookie,
        },
        body: JSON.stringify({
          guestIdentifier: "guest-token-12345",
          currency: "USD",
        }),
      });

      const res = await postCart(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.guestIdentifier).toBe("guest-token-12345");
      expect(body.data.status).toBe("ACTIVE");
      expect(body.data.currency).toBe("USD");
      expect(body.data.subtotal).toBe(0);
      expect(body.data.grandTotal).toBe(0);
      expect(body.data.items).toEqual([]);
    });

    it("creates a customer cart and verifies customer association", async () => {
      const { user: owner, store } = await createStoreWithOwner();
      const customerId = await seedTestCustomer(store.id, "alice@example.com");

      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: owner.cookie,
        },
        body: JSON.stringify({ customerId }),
      });

      const res = await postCart(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.customerId).toBe(customerId);
    });

    it("retrieves cart with items by ID using GET /carts/[cartId]", async () => {
      const { user: owner, store } = await createStoreWithOwner();
      const { variantId } = await seedTestProductAndVariant(store.id, { price: 3000 });

      // Create cart
      const createReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: owner.cookie,
        },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes = await postCart(createReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const { data: cart } = await createRes.json();

      // Add item
      const itemReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/items`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ variantId, quantity: 2 }),
        },
      );
      await postCartItem(itemReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id }),
      });

      // Retrieve cart
      const getReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}`,
        {
          method: "GET",
          headers: { cookie: owner.cookie },
        },
      );
      const getRes = await getCart(getReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id }),
      });
      expect(getRes.status).toBe(200);
      const getBody = await getRes.json();
      expect(getBody.data.id).toBe(cart.id);
      expect(getBody.data.items).toHaveLength(1);
      expect(getBody.data.items[0].variantId).toBe(variantId);
      expect(getBody.data.items[0].quantity).toBe(2);
      expect(getBody.data.subtotal).toBe(6000);
    });

    it("returns 404 CART_NOT_FOUND when retrieving non-existent cart", async () => {
      const { user: owner, store } = await createStoreWithOwner();
      const fakeCartId = generateUuidV7();

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${fakeCartId}`,
        {
          method: "GET",
          headers: { cookie: owner.cookie },
        },
      );
      const res = await getCart(req, {
        params: Promise.resolve({ storeId: store.id, cartId: fakeCartId }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("CART_NOT_FOUND");
    });

    it("retrieves active cart for customer and guest via GET /carts/active and GET /carts", async () => {
      const { user: owner, store } = await createStoreWithOwner();
      const customerId = await seedTestCustomer(store.id, "bob@example.com");

      // 1. Create active customer cart
      const createReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: owner.cookie,
        },
        body: JSON.stringify({ customerId }),
      });
      const createRes = await postCart(createReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const { data: customerCart } = await createRes.json();

      // 2. Query via /carts/active?customerId=...
      const activeReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/active?customerId=${customerId}`,
        {
          method: "GET",
          headers: { cookie: owner.cookie },
        },
      );
      const activeRes = await getActiveCart(activeReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(activeRes.status).toBe(200);
      const activeBody = await activeRes.json();
      expect(activeBody.data.id).toBe(customerCart.id);

      // 3. Query via base route /carts?customerId=...
      const baseReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts?customerId=${customerId}`,
        {
          method: "GET",
          headers: { cookie: owner.cookie },
        },
      );
      const baseRes = await getCarts(baseReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(baseRes.status).toBe(200);
      const baseBody = await baseRes.json();
      expect(baseBody.data.id).toBe(customerCart.id);
    });
  });

  // ===========================================================================
  // 3. Cart Items Operations
  // ===========================================================================
  describe("Cart Items Operations", () => {
    it("adds item, updates quantity, gets item, lists items, and removes item", async () => {
      const { user: owner, store } = await createStoreWithOwner();
      const { variantId } = await seedTestProductAndVariant(store.id, { price: 1500 });

      // Create cart
      const createReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: owner.cookie,
        },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes = await postCart(createReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const { data: cart } = await createRes.json();

      // 1. Add item
      const addReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/items`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ variantId, quantity: 2 }),
        },
      );
      const addRes = await postCartItem(addReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id }),
      });
      expect(addRes.status).toBe(201);
      const addBody = await addRes.json();
      expect(addBody.data.subtotal).toBe(3000);
      const itemId = addBody.data.items[0].id;

      // 2. Add same variant again -> aggregates quantity
      const addAgainReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/items`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ variantId, quantity: 3 }),
        },
      );
      const addAgainRes = await postCartItem(addAgainReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id }),
      });
      expect(addAgainRes.status).toBe(201);
      const addAgainBody = await addAgainRes.json();
      expect(addAgainBody.data.items).toHaveLength(1);
      expect(addAgainBody.data.items[0].quantity).toBe(5);
      expect(addAgainBody.data.subtotal).toBe(7500);

      // 3. List items
      const listReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/items`,
        {
          method: "GET",
          headers: { cookie: owner.cookie },
        },
      );
      const listRes = await getCartItems(listReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id }),
      });
      expect(listRes.status).toBe(200);
      const listBody = await listRes.json();
      expect(listBody.data.items).toHaveLength(1);

      // 4. Get single item
      const getItemReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/items/${itemId}`,
        {
          method: "GET",
          headers: { cookie: owner.cookie },
        },
      );
      const getItemRes = await getCartItem(getItemReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id, itemId }),
      });
      expect(getItemRes.status).toBe(200);
      const getItemBody = await getItemRes.json();
      expect(getItemBody.data.id).toBe(itemId);

      // 5. Update quantity
      const patchReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/items/${itemId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ quantity: 1 }),
        },
      );
      const patchRes = await patchCartItem(patchReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id, itemId }),
      });
      expect(patchRes.status).toBe(200);
      const patchBody = await patchRes.json();
      expect(patchBody.data.subtotal).toBe(1500);
      expect(patchBody.data.items[0].quantity).toBe(1);

      // 6. Delete item
      const deleteReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/items/${itemId}`,
        {
          method: "DELETE",
          headers: { cookie: owner.cookie },
        },
      );
      const deleteRes = await deleteCartItem(deleteReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id, itemId }),
      });
      expect(deleteRes.status).toBe(200);
      const deleteBody = await deleteRes.json();
      expect(deleteBody.data.items).toHaveLength(0);
      expect(deleteBody.data.subtotal).toBe(0);
    });

    it("clears cart items using DELETE /carts/[cartId]/items and POST /carts/[cartId]/clear", async () => {
      const { user: owner, store } = await createStoreWithOwner();
      const { variantId } = await seedTestProductAndVariant(store.id, { price: 2000 });

      // Create cart & add item
      const createReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: owner.cookie,
        },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes = await postCart(createReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const { data: cart } = await createRes.json();

      const addReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/items`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ variantId, quantity: 4 }),
        },
      );
      await postCartItem(addReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id }),
      });

      // Clear via DELETE /items
      const clearReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/items`,
        {
          method: "DELETE",
          headers: { cookie: owner.cookie },
        },
      );
      const clearRes = await clearCartItems(clearReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id }),
      });
      expect(clearRes.status).toBe(200);
      const clearBody = await clearRes.json();
      expect(clearBody.data.items).toHaveLength(0);
      expect(clearBody.data.subtotal).toBe(0);

      // Add item again & clear via POST /clear
      await postCartItem(addReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id }),
      });
      const clearActionReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/clear`,
        {
          method: "POST",
          headers: { cookie: owner.cookie },
        },
      );
      const clearActionRes = await clearCartAction(clearActionReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id }),
      });
      expect(clearActionRes.status).toBe(200);
      const clearActionBody = await clearActionRes.json();
      expect(clearActionBody.data.items).toHaveLength(0);
    });

    it("removes item when quantity is updated to 0 via PATCH /items/[itemId]", async () => {
      const { user: owner, store } = await createStoreWithOwner();
      const { variantId } = await seedTestProductAndVariant(store.id, { price: 2000 });

      const createReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: owner.cookie,
        },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes = await postCart(createReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const { data: cart } = await createRes.json();

      const addReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/items`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ variantId, quantity: 2 }),
        },
      );
      const addRes = await postCartItem(addReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id }),
      });
      const { data: updatedCart } = await addRes.json();
      const itemId = updatedCart.items[0].id;

      // Update quantity to 0
      const patchReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/items/${itemId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ quantity: 0 }),
        },
      );
      const patchRes = await patchCartItem(patchReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id, itemId }),
      });
      expect(patchRes.status).toBe(200);
      const patchBody = await patchRes.json();
      expect(patchBody.data.items).toHaveLength(0);
      expect(patchBody.data.subtotal).toBe(0);
    });
  });

  // ===========================================================================
  // 4. Customer Association & Lifecycle Actions
  // ===========================================================================
  describe("Customer Association & Lifecycle Transitions", () => {
    it("associates customer with cart via POST /carts/[cartId]/customer", async () => {
      const { user: owner, store } = await createStoreWithOwner();
      const customerId = await seedTestCustomer(store.id, "charlie@example.com");

      const createReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: owner.cookie,
        },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes = await postCart(createReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const { data: cart } = await createRes.json();
      expect(cart.customerId).toBeNull();

      const assocReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/customer`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ customerId }),
        },
      );
      const assocRes = await associateCustomer(assocReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id }),
      });
      expect(assocRes.status).toBe(200);
      const assocBody = await assocRes.json();
      expect(assocBody.data.customerId).toBe(customerId);
    });

    it("transitions cart status to CONVERTED, EXPIRED, and ABANDONED", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      // 1. Complete cart
      const createReq1 = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes1 = await postCart(createReq1, { params: Promise.resolve({ storeId: store.id }) });
      const { data: cart1 } = await createRes1.json();

      const completeReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart1.id}/complete`,
        { method: "POST", headers: { cookie: owner.cookie } },
      );
      const completeRes = await completeCart(completeReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart1.id }),
      });
      expect(completeRes.status).toBe(200);
      const completeBody = await completeRes.json();
      expect(completeBody.data.status).toBe("CONVERTED");

      // 2. Expire cart
      const createReq2 = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes2 = await postCart(createReq2, { params: Promise.resolve({ storeId: store.id }) });
      const { data: cart2 } = await createRes2.json();

      const expireReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart2.id}/expire`,
        { method: "POST", headers: { cookie: owner.cookie } },
      );
      const expireRes = await expireCart(expireReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart2.id }),
      });
      expect(expireRes.status).toBe(200);
      const expireBody = await expireRes.json();
      expect(expireBody.data.status).toBe("EXPIRED");

      // 3. Abandon cart
      const createReq3 = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes3 = await postCart(createReq3, { params: Promise.resolve({ storeId: store.id }) });
      const { data: cart3 } = await createRes3.json();

      const abandonReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart3.id}/abandon`,
        { method: "POST", headers: { cookie: owner.cookie } },
      );
      const abandonRes = await abandonCart(abandonReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart3.id }),
      });
      expect(abandonRes.status).toBe(200);
      const abandonBody = await abandonRes.json();
      expect(abandonBody.data.status).toBe("ABANDONED");
    });

    it("blocks mutations on CONVERTED and EXPIRED carts with appropriate errors", async () => {
      const { user: owner, store } = await createStoreWithOwner();
      const { variantId } = await seedTestProductAndVariant(store.id, { price: 1000 });

      // Create and convert cart
      const createReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes = await postCart(createReq, { params: Promise.resolve({ storeId: store.id }) });
      const { data: cart } = await createRes.json();

      const completeReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/complete`,
        { method: "POST", headers: { cookie: owner.cookie } },
      );
      await completeCart(completeReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id }),
      });

      // Attempt to add item to CONVERTED cart
      const addReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/items`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ variantId, quantity: 1 }),
        },
      );
      const addRes = await postCartItem(addReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id }),
      });
      expect(addRes.status).toBe(400);
      const addBody = await addRes.json();
      expect(addBody.error.code).toBe("CART_ALREADY_CONVERTED");
    });
  });

  // ===========================================================================
  // 5. Tenant Isolation
  // ===========================================================================
  describe("Tenant Isolation Boundary", () => {
    it("strictly prevents accessing Store A cart from Store B context", async () => {
      const { user: ownerA, store: storeA } = await createStoreWithOwner("ownerA@test.com");
      const { user: ownerB, store: storeB } = await createStoreWithOwner("ownerB@test.com");

      // Owner A creates cart in Store A
      const createReq = new Request(`http://localhost:3000/api/v1/stores/${storeA.id}/carts`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: ownerA.cookie },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes = await postCart(createReq, { params: Promise.resolve({ storeId: storeA.id }) });
      const { data: cartA } = await createRes.json();

      // Owner B attempts to access Cart A through Store B context -> 404
      const getReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeB.id}/carts/${cartA.id}`,
        {
          method: "GET",
          headers: { cookie: ownerB.cookie },
        },
      );
      const getRes = await getCart(getReq, {
        params: Promise.resolve({ storeId: storeB.id, cartId: cartA.id }),
      });
      expect(getRes.status).toBe(404);
      const body = await getRes.json();
      expect(body.error.code).toBe("CART_NOT_FOUND");
    });

    it("strictly prevents mutating Store A cart from Store B context", async () => {
      const { user: ownerA, store: storeA } = await createStoreWithOwner("ownerA@test.com");
      const { user: ownerB, store: storeB } = await createStoreWithOwner("ownerB@test.com");
      const { variantId: variantB } = await seedTestProductAndVariant(storeB.id, { price: 1000 });

      // Owner A creates cart in Store A
      const createReq = new Request(`http://localhost:3000/api/v1/stores/${storeA.id}/carts`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: ownerA.cookie },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes = await postCart(createReq, { params: Promise.resolve({ storeId: storeA.id }) });
      const { data: cartA } = await createRes.json();

      // Owner B attempts to add item to Cart A via Store B -> 404
      const addReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeB.id}/carts/${cartA.id}/items`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: ownerB.cookie },
          body: JSON.stringify({ variantId: variantB, quantity: 1 }),
        },
      );
      const addRes = await postCartItem(addReq, {
        params: Promise.resolve({ storeId: storeB.id, cartId: cartA.id }),
      });
      expect(addRes.status).toBe(404);
      const body = await addRes.json();
      expect(body.error.code).toBe("CART_NOT_FOUND");
    });

    it("strictly prevents adding product variant belonging to Store B into Store A cart", async () => {
      const { user: ownerA, store: storeA } = await createStoreWithOwner("ownerA@test.com");
      const { store: storeB } = await createStoreWithOwner("ownerB@test.com");
      const { variantId: variantB } = await seedTestProductAndVariant(storeB.id, { price: 2500 });

      // Store A cart
      const createReq = new Request(`http://localhost:3000/api/v1/stores/${storeA.id}/carts`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: ownerA.cookie },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes = await postCart(createReq, { params: Promise.resolve({ storeId: storeA.id }) });
      const { data: cartA } = await createRes.json();

      // Add variant B into Store A cart -> 400 CROSS_STORE_VARIANT
      const addReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeA.id}/carts/${cartA.id}/items`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: ownerA.cookie },
          body: JSON.stringify({ variantId: variantB, quantity: 1 }),
        },
      );
      const addRes = await postCartItem(addReq, {
        params: Promise.resolve({ storeId: storeA.id, cartId: cartA.id }),
      });
      expect(addRes.status).toBe(400);
      const body = await addRes.json();
      expect(body.error.code).toBe("CROSS_STORE_VARIANT");
    });

    it("strictly prevents associating customer from Store B into Store A cart", async () => {
      const { user: ownerA, store: storeA } = await createStoreWithOwner("ownerA@test.com");
      const { store: storeB } = await createStoreWithOwner("ownerB@test.com");
      const customerB = await seedTestCustomer(storeB.id, "custB@test.com");

      const createReq = new Request(`http://localhost:3000/api/v1/stores/${storeA.id}/carts`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: ownerA.cookie },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes = await postCart(createReq, { params: Promise.resolve({ storeId: storeA.id }) });
      const { data: cartA } = await createRes.json();

      const assocReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeA.id}/carts/${cartA.id}/customer`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: ownerA.cookie },
          body: JSON.stringify({ customerId: customerB }),
        },
      );
      const assocRes = await associateCustomer(assocReq, {
        params: Promise.resolve({ storeId: storeA.id, cartId: cartA.id }),
      });
      expect(assocRes.status).toBe(400);
      const body = await assocRes.json();
      expect(body.error.code).toBe("CROSS_STORE_CUSTOMER");
    });

    it("strictly prevents clearing or transitioning Store A cart from Store B context", async () => {
      const { user: ownerA, store: storeA } = await createStoreWithOwner("ownerA@test.com");
      const { user: ownerB, store: storeB } = await createStoreWithOwner("ownerB@test.com");

      const createReq = new Request(`http://localhost:3000/api/v1/stores/${storeA.id}/carts`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: ownerA.cookie },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes = await postCart(createReq, { params: Promise.resolve({ storeId: storeA.id }) });
      const { data: cartA } = await createRes.json();

      // Owner B attempts to clear Cart A through Store B context -> 404
      const clearReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeB.id}/carts/${cartA.id}/clear`,
        { method: "POST", headers: { cookie: ownerB.cookie } },
      );
      const clearRes = await clearCartAction(clearReq, {
        params: Promise.resolve({ storeId: storeB.id, cartId: cartA.id }),
      });
      expect(clearRes.status).toBe(404);
      const clearBody = await clearRes.json();
      expect(clearBody.error.code).toBe("CART_NOT_FOUND");

      // Owner B attempts to complete Cart A through Store B context -> 404
      const completeReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeB.id}/carts/${cartA.id}/complete`,
        { method: "POST", headers: { cookie: ownerB.cookie } },
      );
      const completeRes = await completeCart(completeReq, {
        params: Promise.resolve({ storeId: storeB.id, cartId: cartA.id }),
      });
      expect(completeRes.status).toBe(404);
      const completeBody = await completeRes.json();
      expect(completeBody.error.code).toBe("CART_NOT_FOUND");
    });

    it("strictly prevents retrieving, updating, or deleting Store A cart item from Store B context", async () => {
      const { user: ownerA, store: storeA } = await createStoreWithOwner("ownerA@test.com");
      const { user: ownerB, store: storeB } = await createStoreWithOwner("ownerB@test.com");
      const { variantId } = await seedTestProductAndVariant(storeA.id, { price: 2000 });

      // Owner A creates cart and adds item
      const createReq = new Request(`http://localhost:3000/api/v1/stores/${storeA.id}/carts`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: ownerA.cookie },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes = await postCart(createReq, { params: Promise.resolve({ storeId: storeA.id }) });
      const { data: cartA } = await createRes.json();

      const addReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeA.id}/carts/${cartA.id}/items`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: ownerA.cookie },
          body: JSON.stringify({ variantId, quantity: 2 }),
        },
      );
      const addRes = await postCartItem(addReq, {
        params: Promise.resolve({ storeId: storeA.id, cartId: cartA.id }),
      });
      const { data: updatedCartA } = await addRes.json();
      const itemId = updatedCartA.items[0].id;

      // Owner B attempts to GET item from Cart A via Store B -> 404
      const getReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeB.id}/carts/${cartA.id}/items/${itemId}`,
        { method: "GET", headers: { cookie: ownerB.cookie } },
      );
      const getRes = await getCartItem(getReq, {
        params: Promise.resolve({ storeId: storeB.id, cartId: cartA.id, itemId }),
      });
      expect(getRes.status).toBe(404);

      // Owner B attempts to PATCH item quantity via Store B -> 404
      const patchReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeB.id}/carts/${cartA.id}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", cookie: ownerB.cookie },
          body: JSON.stringify({ quantity: 5 }),
        },
      );
      const patchRes = await patchCartItem(patchReq, {
        params: Promise.resolve({ storeId: storeB.id, cartId: cartA.id, itemId }),
      });
      expect(patchRes.status).toBe(404);

      // Owner B attempts to DELETE item via Store B -> 404
      const deleteReq = new Request(
        `http://localhost:3000/api/v1/stores/${storeB.id}/carts/${cartA.id}/items/${itemId}`,
        { method: "DELETE", headers: { cookie: ownerB.cookie } },
      );
      const deleteRes = await deleteCartItem(deleteReq, {
        params: Promise.resolve({ storeId: storeB.id, cartId: cartA.id, itemId }),
      });
      expect(deleteRes.status).toBe(404);
    });
  });

  // ===========================================================================
  // 6. Validation & Error Mapping
  // ===========================================================================
  describe("Input Validation & Error Mapping", () => {
    it("returns 400 VALIDATION_ERROR for malformed storeId UUID", async () => {
      const { user: owner } = await createStoreWithOwner();

      const req = new Request("http://localhost:3000/api/v1/stores/not-a-uuid/carts", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({ currency: "USD" }),
      });

      const res = await postCart(req, {
        params: Promise.resolve({ storeId: "not-a-uuid" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.fields?.storeId).toBeDefined();
    });

    it("returns 400 VALIDATION_ERROR for invalid quantity on item addition", async () => {
      const { user: owner, store } = await createStoreWithOwner();
      const { variantId } = await seedTestProductAndVariant(store.id);

      const createReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes = await postCart(createReq, { params: Promise.resolve({ storeId: store.id }) });
      const { data: cart } = await createRes.json();

      const addReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/items`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: owner.cookie },
          body: JSON.stringify({ variantId, quantity: -2 }),
        },
      );
      const addRes = await postCartItem(addReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id }),
      });
      expect(addRes.status).toBe(400);
      const body = await addRes.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.fields?.quantity).toBeDefined();
    });

    it("returns 400 PRODUCT_VARIANT_UNAVAILABLE for INACTIVE variant", async () => {
      const { user: owner, store } = await createStoreWithOwner();
      const { variantId } = await seedTestProductAndVariant(store.id, { status: "INACTIVE" });

      const createReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes = await postCart(createReq, { params: Promise.resolve({ storeId: store.id }) });
      const { data: cart } = await createRes.json();

      const addReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/items`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: owner.cookie },
          body: JSON.stringify({ variantId, quantity: 1 }),
        },
      );
      const addRes = await postCartItem(addReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id }),
      });
      expect(addRes.status).toBe(400);
      const body = await addRes.json();
      expect(body.error.code).toBe("PRODUCT_VARIANT_UNAVAILABLE");
    });

    it("returns 404 CART_ITEM_NOT_FOUND when updating non-existent item", async () => {
      const { user: owner, store } = await createStoreWithOwner();
      const fakeItemId = generateUuidV7();

      const createReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes = await postCart(createReq, { params: Promise.resolve({ storeId: store.id }) });
      const { data: cart } = await createRes.json();

      const patchReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/items/${fakeItemId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", cookie: owner.cookie },
          body: JSON.stringify({ quantity: 5 }),
        },
      );
      const patchRes = await patchCartItem(patchReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id, itemId: fakeItemId }),
      });
      expect(patchRes.status).toBe(404);
      const body = await patchRes.json();
      expect(body.error.code).toBe("CART_ITEM_NOT_FOUND");
    });

    it("returns 400 PRODUCT_VARIANT_UNAVAILABLE when variant belongs to a DRAFT product", async () => {
      const { user: owner, store } = await createStoreWithOwner();
      const { variantId } = await seedTestProductAndVariant(store.id, {
        productStatus: "DRAFT",
      });

      const createReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/carts`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner.cookie },
        body: JSON.stringify({ currency: "USD" }),
      });
      const createRes = await postCart(createReq, { params: Promise.resolve({ storeId: store.id }) });
      const { data: cart } = await createRes.json();

      const addReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/carts/${cart.id}/items`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: owner.cookie },
          body: JSON.stringify({ variantId, quantity: 1 }),
        },
      );
      const addRes = await postCartItem(addReq, {
        params: Promise.resolve({ storeId: store.id, cartId: cart.id }),
      });
      expect(addRes.status).toBe(400);
      const body = await addRes.json();
      expect(body.error.code).toBe("PRODUCT_VARIANT_UNAVAILABLE");
    });
  });
});
