import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@calcart/db";
import { serializeSessionCookie } from "@calcart/auth";
import { StoreService } from "@calcart/stores";
import { ProductService } from "@calcart/products";
import { createIsolatedDatabase } from "./helpers/postgres.js";

import { GET as getInventory } from "../apps/web/app/api/v1/stores/[storeId]/inventory/route.js";
import { GET as getVariantInventory } from "../apps/web/app/api/v1/stores/[storeId]/inventory/[variantId]/route.js";
import { POST as adjustStock } from "../apps/web/app/api/v1/stores/[storeId]/inventory/[variantId]/adjust/route.js";
import { GET as getHistory } from "../apps/web/app/api/v1/stores/[storeId]/inventory/[variantId]/history/route.js";
import { GET as getItemById } from "../apps/web/app/api/v1/stores/[storeId]/inventory/items/[itemId]/route.js";
import { POST as createReservation } from "../apps/web/app/api/v1/stores/[storeId]/inventory/reservations/route.js";
import { GET as getReservation } from "../apps/web/app/api/v1/stores/[storeId]/inventory/reservations/[reservationId]/route.js";
import { POST as releaseReservation } from "../apps/web/app/api/v1/stores/[storeId]/inventory/reservations/[reservationId]/release/route.js";
import { POST as finalizeReservation } from "../apps/web/app/api/v1/stores/[storeId]/inventory/reservations/[reservationId]/finalize/route.js";
import { POST as commitReservation } from "../apps/web/app/api/v1/stores/[storeId]/inventory/reservations/[reservationId]/commit/route.js";

declare global {
  var __calcart_web_db: unknown;
}

describe("Inventory API Endpoints (/api/v1/stores/[storeId]/inventory/*)", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();
  const productService = new ProductService();

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

  async function createStoreWithProduct(email = "owner@test.com", slug = "store-test") {
    const user = await createAuthenticatedUser(email);
    const store = await storeService.createStore(db, user.userId, {
      name: "Inventory Test Store",
      slug,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });

    const product = await productService.createProduct(db, store.id, {
      title: "Test Shirt",
      price: 2500,
    });

    const variantId = product.variants[0]!.id;
    return { user, store, product, variantId };
  }

  // -------------------------------------------------------------------------
  // 1. Authentication Tests
  // -------------------------------------------------------------------------
  describe("Authentication", () => {
    it("rejects unauthenticated GET /inventory with 401", async () => {
      const { store } = await createStoreWithProduct();
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/inventory`,
        { method: "GET" },
      );

      const res = await getInventory(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("rejects unauthenticated POST /adjust with 401", async () => {
      const { store, variantId } = await createStoreWithProduct();
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ quantityDelta: 10, reason: "RESTOCK" }),
        },
      );

      const res = await adjustStock(req, {
        params: Promise.resolve({ storeId: store.id, variantId }),
      });
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("rejects unauthenticated POST /reservations with 401", async () => {
      const { store, variantId } = await createStoreWithProduct();
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/inventory/reservations`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            variantId,
            quantity: 2,
            referenceType: "checkout",
            referenceId: "chk_1",
          }),
        },
      );

      const res = await createReservation(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("AUTHENTICATION_REQUIRED");
    });
  });

  // -------------------------------------------------------------------------
  // 2. Tenant Isolation & Authorization Tests
  // -------------------------------------------------------------------------
  describe("Tenant Isolation & Authorization", () => {
    it("returns 404 when non-member requests store inventory", async () => {
      const { store } = await createStoreWithProduct("owner@store1.com", "store-1");
      const outsider = await createAuthenticatedUser("outsider@store2.com");

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/inventory`,
        {
          method: "GET",
          headers: { cookie: outsider.cookie },
        },
      );

      const res = await getInventory(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("NOT_FOUND");
    });

    it("rejects stock adjustment on a variant belonging to another store", async () => {
      const store1 = await createStoreWithProduct("owner1@store1.com", "store-1");
      const store2 = await createStoreWithProduct("owner2@store2.com", "store-2");

      // User in Store 1 attempts to adjust variant belonging to Store 2
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store1.store.id}/inventory/${store2.variantId}/adjust`,
        {
          method: "POST",
          headers: {
            cookie: store1.user.cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({ quantityDelta: 50, reason: "RESTOCK" }),
        },
      );

      const res = await adjustStock(req, {
        params: Promise.resolve({
          storeId: store1.store.id,
          variantId: store2.variantId,
        }),
      });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("CROSS_STORE_INVENTORY_ACCESS");
    });

    it("returns 404 when Store 1 attempts to release a reservation in Store 2", async () => {
      const store1 = await createStoreWithProduct("owner1@store1.com", "store-1");
      const store2 = await createStoreWithProduct("owner2@store2.com", "store-2");

      // Stock up Store 2 and create reservation in Store 2
      await adjustStock(
        new Request(
          `http://localhost:3000/api/v1/stores/${store2.store.id}/inventory/${store2.variantId}/adjust`,
          {
            method: "POST",
            headers: {
              cookie: store2.user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ quantityDelta: 10, reason: "RESTOCK" }),
          },
        ),
        { params: Promise.resolve({ storeId: store2.store.id, variantId: store2.variantId }) },
      );

      const resCreate = await createReservation(
        new Request(
          `http://localhost:3000/api/v1/stores/${store2.store.id}/inventory/reservations`,
          {
            method: "POST",
            headers: {
              cookie: store2.user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              variantId: store2.variantId,
              quantity: 2,
              referenceType: "checkout",
              referenceId: "chk_s2",
            }),
          },
        ),
        { params: Promise.resolve({ storeId: store2.store.id }) },
      );
      const resCreateData = await resCreate.json();
      const reservationId = resCreateData.data.id;

      // Store 1 tries to release Store 2's reservation
      const reqRelease = new Request(
        `http://localhost:3000/api/v1/stores/${store1.store.id}/inventory/reservations/${reservationId}/release`,
        {
          method: "POST",
          headers: { cookie: store1.user.cookie },
        },
      );

      const resRelease = await releaseReservation(reqRelease, {
        params: Promise.resolve({
          storeId: store1.store.id,
          reservationId,
        }),
      });
      const releaseData = await resRelease.json();

      expect(resRelease.status).toBe(404);
      expect(releaseData.success).toBe(false);
      expect(releaseData.error.code).toBe("RESERVATION_NOT_FOUND");
    });
  });

  // -------------------------------------------------------------------------
  // 3. Validation Tests
  // -------------------------------------------------------------------------
  describe("Input Validation", () => {
    it("rejects malformed storeId UUID with 400 VALIDATION_ERROR", async () => {
      const { user } = await createStoreWithProduct();
      const req = new Request(
        "http://localhost:3000/api/v1/stores/not-a-valid-uuid/inventory",
        {
          method: "GET",
          headers: { cookie: user.cookie },
        },
      );

      const res = await getInventory(req, {
        params: Promise.resolve({ storeId: "not-a-valid-uuid" }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects malformed variantId UUID with 400 VALIDATION_ERROR", async () => {
      const { user, store } = await createStoreWithProduct();
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/inventory/bad-uuid`,
        {
          method: "GET",
          headers: { cookie: user.cookie },
        },
      );

      const res = await getVariantInventory(req, {
        params: Promise.resolve({ storeId: store.id, variantId: "bad-uuid" }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects quantityDelta equal to 0 with 400 VALIDATION_ERROR", async () => {
      const { user, store, variantId } = await createStoreWithProduct();
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
        {
          method: "POST",
          headers: {
            cookie: user.cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({ quantityDelta: 0, reason: "RESTOCK" }),
        },
      );

      const res = await adjustStock(req, {
        params: Promise.resolve({ storeId: store.id, variantId }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("VALIDATION_ERROR");
      expect(data.error.fields?.quantityDelta).toBeDefined();
    });

    it("rejects non-integer quantityDelta with 400 VALIDATION_ERROR", async () => {
      const { user, store, variantId } = await createStoreWithProduct();
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
        {
          method: "POST",
          headers: {
            cookie: user.cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({ quantityDelta: 3.5, reason: "RESTOCK" }),
        },
      );

      const res = await adjustStock(req, {
        params: Promise.resolve({ storeId: store.id, variantId }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects invalid adjustment reason with 400 VALIDATION_ERROR", async () => {
      const { user, store, variantId } = await createStoreWithProduct();
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
        {
          method: "POST",
          headers: {
            cookie: user.cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({ quantityDelta: 10, reason: "INVALID_REASON" }),
        },
      );

      const res = await adjustStock(req, {
        params: Promise.resolve({ storeId: store.id, variantId }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("VALIDATION_ERROR");
      expect(data.error.fields?.reason).toBeDefined();
    });

    it("rejects history limit exceeding 100 with 400 VALIDATION_ERROR", async () => {
      const { user, store, variantId } = await createStoreWithProduct();
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/history?limit=105`,
        {
          method: "GET",
          headers: { cookie: user.cookie },
        },
      );

      const res = await getHistory(req, {
        params: Promise.resolve({ storeId: store.id, variantId }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects Idempotency-Key exceeding 255 chars with 400 VALIDATION_ERROR", async () => {
      const { user, store, variantId } = await createStoreWithProduct();
      const overlyLongKey = "a".repeat(256);
      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
        {
          method: "POST",
          headers: {
            cookie: user.cookie,
            "content-type": "application/json",
            "Idempotency-Key": overlyLongKey,
          },
          body: JSON.stringify({ quantityDelta: 5, reason: "RESTOCK" }),
        },
      );

      const res = await adjustStock(req, {
        params: Promise.resolve({ storeId: store.id, variantId }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // -------------------------------------------------------------------------
  // 4. Stock Adjustments & Availability Tests
  // -------------------------------------------------------------------------
  describe("Stock Adjustments & Availability", () => {
    it("adjusts stock, creates inventory item, and returns DTO envelope", async () => {
      const { user, store, variantId } = await createStoreWithProduct();

      const req = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
        {
          method: "POST",
          headers: {
            cookie: user.cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            quantityDelta: 50,
            reason: "INITIAL_STOCK",
            referenceType: "po",
            referenceId: "po_1001",
          }),
        },
      );

      const res = await adjustStock(req, {
        params: Promise.resolve({ storeId: store.id, variantId }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.item.availableQuantity).toBe(50);
      expect(data.data.item.reservedQuantity).toBe(0);
      expect(data.data.item.totalQuantity).toBe(50);
      expect(data.data.adjustment.quantityDelta).toBe(50);
      expect(data.data.adjustment.reason).toBe("INITIAL_STOCK");
      expect(data.data.adjustment.createdBy).toBe(user.userId);
    });

    it("retrieves inventory item and availability via GET endpoints", async () => {
      const { user, store, variantId } = await createStoreWithProduct();

      // Initial restock
      await adjustStock(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ quantityDelta: 30, reason: "RESTOCK" }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );

      // GET /inventory/[variantId]
      const resItem = await getVariantInventory(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}`,
          { headers: { cookie: user.cookie } },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );
      const itemData = await resItem.json();

      expect(resItem.status).toBe(200);
      expect(itemData.success).toBe(true);
      expect(itemData.data.availableQuantity).toBe(30);
      expect(itemData.data.totalQuantity).toBe(30);

      // GET /inventory/[variantId]?availability=true
      const resAvail = await getVariantInventory(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}?availability=true`,
          { headers: { cookie: user.cookie } },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );
      const availData = await resAvail.json();

      expect(resAvail.status).toBe(200);
      expect(availData.success).toBe(true);
      expect(availData.data.availableQuantity).toBe(30);
      expect(availData.data.isAvailable).toBe(true);

      // GET /inventory/items/[itemId]
      const itemId = itemData.data.id;
      const resById = await getItemById(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/items/${itemId}`,
          { headers: { cookie: user.cookie } },
        ),
        { params: Promise.resolve({ storeId: store.id, itemId }) },
      );
      const byIdData = await resById.json();

      expect(resById.status).toBe(200);
      expect(byIdData.success).toBe(true);
      expect(byIdData.data.id).toBe(itemId);
      expect(byIdData.data.availableQuantity).toBe(30);

      // GET /inventory?variantId=...
      const resQuery = await getInventory(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory?variantId=${variantId}`,
          { headers: { cookie: user.cookie } },
        ),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const queryData = await resQuery.json();

      expect(resQuery.status).toBe(200);
      expect(queryData.success).toBe(true);
      expect(queryData.data.availableQuantity).toBe(30);
    });

    it("lists store inventory items with search and status filtering when variantId is omitted", async () => {
      const { user, store, variantId } = await createStoreWithProduct();

      // Restock 4 items (low stock threshold is <= 5)
      await adjustStock(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ quantityDelta: 4, reason: "RESTOCK" }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );

      // GET /inventory without variantId - lists all store items
      const resAll = await getInventory(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory`,
          { headers: { cookie: user.cookie } },
        ),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const allData = await resAll.json();
      expect(resAll.status).toBe(200);
      expect(allData.success).toBe(true);
      expect(Array.isArray(allData.data.items)).toBe(true);
      expect(allData.data.items.length).toBeGreaterThanOrEqual(1);

      const foundItem = allData.data.items.find((i: { variantId: string }) => i.variantId === variantId);
      expect(foundItem).toBeDefined();
      expect(foundItem.availableQuantity).toBe(4);
      expect(foundItem.isInitialized).toBe(true);

      // GET /inventory?status=low_stock
      const resLow = await getInventory(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory?status=low_stock`,
          { headers: { cookie: user.cookie } },
        ),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const lowData = await resLow.json();
      expect(resLow.status).toBe(200);
      expect(lowData.data.items.some((i: { variantId: string }) => i.variantId === variantId)).toBe(true);

      // GET /inventory?status=out_of_stock - should NOT match this item
      const resOut = await getInventory(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory?status=out_of_stock`,
          { headers: { cookie: user.cookie } },
        ),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const outData = await resOut.json();
      expect(resOut.status).toBe(200);
      expect(outData.data.items.some((i: { variantId: string }) => i.variantId === variantId)).toBe(false);
    });

    it("rejects negative adjustment reducing stock below zero with 409 INSUFFICIENT_INVENTORY", async () => {
      const { user, store, variantId } = await createStoreWithProduct();

      // Restock 10
      await adjustStock(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ quantityDelta: 10, reason: "RESTOCK" }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );

      // Attempt delta -15
      const res = await adjustStock(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              quantityDelta: -15,
              reason: "DAMAGED",
            }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INSUFFICIENT_INVENTORY");
    });
  });

  // -------------------------------------------------------------------------
  // 5. Adjustment History Tests
  // -------------------------------------------------------------------------
  describe("Adjustment History", () => {
    it("records and retrieves adjustment history in chronological order", async () => {
      const { user, store, variantId } = await createStoreWithProduct();

      // Apply two adjustments
      await adjustStock(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ quantityDelta: 20, reason: "RESTOCK" }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );

      await adjustStock(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ quantityDelta: -5, reason: "DAMAGED" }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );

      // Retrieve history
      const res = await getHistory(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/history?limit=10`,
          { headers: { cookie: user.cookie } },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.items).toHaveLength(2);
      expect(data.data.items[0].quantityDelta).toBe(-5);
      expect(data.data.items[0].reason).toBe("DAMAGED");
      expect(data.data.items[1].quantityDelta).toBe(20);
      expect(data.data.items[1].reason).toBe("RESTOCK");
    });
  });

  // -------------------------------------------------------------------------
  // 6. Reservation Operations (Single & Multi-Item, Release, Finalize)
  // -------------------------------------------------------------------------
  describe("Reservations", () => {
    it("creates, retrieves, and releases a single-item reservation", async () => {
      const { user, store, variantId } = await createStoreWithProduct();

      // Initial stock: 15
      await adjustStock(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ quantityDelta: 15, reason: "RESTOCK" }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );

      // 1. Create reservation of 5
      const resCreate = await createReservation(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/reservations`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              variantId,
              quantity: 5,
              referenceType: "checkout",
              referenceId: "chk_test_1",
            }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const createData = await resCreate.json();

      expect(resCreate.status).toBe(201);
      expect(createData.success).toBe(true);
      expect(createData.data.quantity).toBe(5);
      expect(createData.data.status).toBe("ACTIVE");

      const reservationId = createData.data.id;

      // Verify stock state: available = 10, reserved = 5
      const resItem = await getVariantInventory(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}`,
          { headers: { cookie: user.cookie } },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );
      const itemData = await resItem.json();
      expect(itemData.data.availableQuantity).toBe(10);
      expect(itemData.data.reservedQuantity).toBe(5);

      // 2. GET reservation by ID
      const resGet = await getReservation(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/reservations/${reservationId}`,
          { headers: { cookie: user.cookie } },
        ),
        { params: Promise.resolve({ storeId: store.id, reservationId }) },
      );
      const getData = await resGet.json();
      expect(resGet.status).toBe(200);
      expect(getData.data.id).toBe(reservationId);
      expect(getData.data.status).toBe("ACTIVE");

      // 3. Release reservation
      const resRelease = await releaseReservation(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/reservations/${reservationId}/release`,
          {
            method: "POST",
            headers: { cookie: user.cookie },
          },
        ),
        { params: Promise.resolve({ storeId: store.id, reservationId }) },
      );
      const releaseData = await resRelease.json();

      expect(resRelease.status).toBe(200);
      expect(releaseData.data.status).toBe("RELEASED");

      // Verify stock restored: available = 15, reserved = 0
      const resRestored = await getVariantInventory(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}`,
          { headers: { cookie: user.cookie } },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );
      const restoredData = await resRestored.json();
      expect(restoredData.data.availableQuantity).toBe(15);
      expect(restoredData.data.reservedQuantity).toBe(0);
    });

    it("creates and finalizes (commits) a reservation", async () => {
      const { user, store, variantId } = await createStoreWithProduct();

      await adjustStock(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ quantityDelta: 10, reason: "RESTOCK" }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );

      // Create reservation
      const resCreate = await createReservation(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/reservations`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              variantId,
              quantity: 4,
              referenceType: "checkout",
              referenceId: "chk_test_commit",
            }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const createData = await resCreate.json();
      const reservationId = createData.data.id;

      // Finalize reservation
      const resFinalize = await finalizeReservation(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/reservations/${reservationId}/finalize`,
          {
            method: "POST",
            headers: { cookie: user.cookie },
          },
        ),
        { params: Promise.resolve({ storeId: store.id, reservationId }) },
      );
      const finalizeData = await resFinalize.json();

      expect(resFinalize.status).toBe(200);
      expect(finalizeData.data.status).toBe("COMMITTED");

      // Verify stock state: available = 6, reserved = 0
      const resItem = await getVariantInventory(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}`,
          { headers: { cookie: user.cookie } },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );
      const itemData = await resItem.json();
      expect(itemData.data.availableQuantity).toBe(6);
      expect(itemData.data.reservedQuantity).toBe(0);

      // Attempting to release a committed reservation returns 400 INVALID_RESERVATION_STATE
      const resInvalidRelease = await releaseReservation(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/reservations/${reservationId}/release`,
          {
            method: "POST",
            headers: { cookie: user.cookie },
          },
        ),
        { params: Promise.resolve({ storeId: store.id, reservationId }) },
      );
      const invalidData = await resInvalidRelease.json();

      expect(resInvalidRelease.status).toBe(400);
      expect(invalidData.success).toBe(false);
      expect(invalidData.error.code).toBe("INVALID_RESERVATION_STATE");
    });

    it("supports /commit endpoint alias for finalization", async () => {
      const { user, store, variantId } = await createStoreWithProduct();

      await adjustStock(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ quantityDelta: 10, reason: "RESTOCK" }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );

      const resCreate = await createReservation(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/reservations`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              variantId,
              quantity: 3,
              referenceType: "checkout",
              referenceId: "chk_alias_test",
            }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const createData = await resCreate.json();
      const reservationId = createData.data.id;

      // Call /commit alias
      const resCommit = await commitReservation(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/reservations/${reservationId}/commit`,
          {
            method: "POST",
            headers: { cookie: user.cookie },
          },
        ),
        { params: Promise.resolve({ storeId: store.id, reservationId }) },
      );
      const commitData = await resCommit.json();

      expect(resCommit.status).toBe(200);
      expect(commitData.data.status).toBe("COMMITTED");
    });

    it("creates multi-item reservations atomically", async () => {
      const { user, store, variantId: v1 } = await createStoreWithProduct();
      const p2 = await productService.createProduct(db, store.id, {
        title: "Pants",
        price: 4000,
      });
      const v2 = p2.variants[0]!.id;

      // Restock both items
      await adjustStock(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${v1}/adjust`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ quantityDelta: 10, reason: "RESTOCK" }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId: v1 }) },
      );

      await adjustStock(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${v2}/adjust`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ quantityDelta: 5, reason: "RESTOCK" }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId: v2 }) },
      );

      // Reserve both items
      const resMulti = await createReservation(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/reservations`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              items: [
                { variantId: v1, quantity: 4 },
                { variantId: v2, quantity: 2 },
              ],
              referenceType: "checkout",
              referenceId: "chk_multi_1",
            }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const multiData = await resMulti.json();

      expect(resMulti.status).toBe(201);
      expect(multiData.success).toBe(true);
      expect(multiData.data.reservations).toHaveLength(2);

      // Check stock
      const resV1 = await getVariantInventory(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${v1}`,
          { headers: { cookie: user.cookie } },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId: v1 }) },
      );
      const v1Data = await resV1.json();
      expect(v1Data.data.availableQuantity).toBe(6);
      expect(v1Data.data.reservedQuantity).toBe(4);
    });

    it("rejects multi-item reservation all-or-nothing if one item has insufficient stock", async () => {
      const { user, store, variantId: v1 } = await createStoreWithProduct();
      const p2 = await productService.createProduct(db, store.id, {
        title: "Hat",
        price: 1500,
      });
      const v2 = p2.variants[0]!.id;

      // Restock v1 to 10, v2 to only 1
      await adjustStock(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${v1}/adjust`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ quantityDelta: 10, reason: "RESTOCK" }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId: v1 }) },
      );

      await adjustStock(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${v2}/adjust`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ quantityDelta: 1, reason: "RESTOCK" }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId: v2 }) },
      );

      // Request 5 of v1 and 5 of v2 (v2 will fail)
      const res = await createReservation(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/reservations`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              items: [
                { variantId: v1, quantity: 5 },
                { variantId: v2, quantity: 5 },
              ],
              referenceType: "checkout",
              referenceId: "chk_fail_multi",
            }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INSUFFICIENT_INVENTORY");

      // Verify v1 stock was not touched (atomic rollback)
      const resV1 = await getVariantInventory(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${v1}`,
          { headers: { cookie: user.cookie } },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId: v1 }) },
      );
      const v1Data = await resV1.json();
      expect(v1Data.data.availableQuantity).toBe(10);
      expect(v1Data.data.reservedQuantity).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Idempotency Tests
  // -------------------------------------------------------------------------
  describe("Idempotency", () => {
    it("handles idempotent stock adjustments via Idempotency-Key header", async () => {
      const { user, store, variantId } = await createStoreWithProduct();
      const idempotencyKey = "adj_idemp_key_123";

      const makeReq = () =>
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
              "Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify({
              quantityDelta: 20,
              reason: "RESTOCK",
            }),
          },
        );

      // First call
      const res1 = await adjustStock(makeReq(), {
        params: Promise.resolve({ storeId: store.id, variantId }),
      });
      const data1 = await res1.json();
      expect(res1.status).toBe(200);
      expect(data1.data.item.availableQuantity).toBe(20);

      // Second call (same key, same payload)
      const res2 = await adjustStock(makeReq(), {
        params: Promise.resolve({ storeId: store.id, variantId }),
      });
      const data2 = await res2.json();
      expect(res2.status).toBe(200);
      expect(data2.data.item.availableQuantity).toBe(20);
      expect(data2.data.adjustment.id).toBe(data1.data.adjustment.id);

      // Third call with DIFFERENT quantityDelta and SAME key fails with 409 conflict
      const conflictReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
        {
          method: "POST",
          headers: {
            cookie: user.cookie,
            "content-type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            quantityDelta: 50,
            reason: "RESTOCK",
          }),
        },
      );

      const resConflict = await adjustStock(conflictReq, {
        params: Promise.resolve({ storeId: store.id, variantId }),
      });
      const conflictData = await resConflict.json();
      expect(resConflict.status).toBe(409);
      expect(conflictData.success).toBe(false);
      expect(conflictData.error.code).toBe("RESERVATION_CONFLICT");
    });

    it("handles idempotent reservations via Idempotency-Key header", async () => {
      const { user, store, variantId } = await createStoreWithProduct();
      const idempotencyKey = "res_idemp_key_456";

      // Seed stock: 30
      await adjustStock(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ quantityDelta: 30, reason: "RESTOCK" }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );

      const makeReq = () =>
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/reservations`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
              "Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify({
              variantId,
              quantity: 5,
            }),
          },
        );

      // First call
      const res1 = await createReservation(makeReq(), {
        params: Promise.resolve({ storeId: store.id }),
      });
      const data1 = await res1.json();
      expect(res1.status).toBe(201);
      expect(data1.data.quantity).toBe(5);

      // Second call (retry with same key)
      const res2 = await createReservation(makeReq(), {
        params: Promise.resolve({ storeId: store.id }),
      });
      const data2 = await res2.json();
      expect(res2.status).toBe(201);
      expect(data2.data.id).toBe(data1.data.id);

      // Verify stock was only deducted once: available = 25, reserved = 5
      const resItem = await getVariantInventory(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}`,
          { headers: { cookie: user.cookie } },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );
      const itemData = await resItem.json();
      expect(itemData.data.availableQuantity).toBe(25);
      expect(itemData.data.reservedQuantity).toBe(5);

      // Different quantity with same key returns 409 conflict
      const conflictReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/inventory/reservations`,
        {
          method: "POST",
          headers: {
            cookie: user.cookie,
            "content-type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            variantId,
            quantity: 10,
          }),
        },
      );
      const resConflict = await createReservation(conflictReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const conflictData = await resConflict.json();
      expect(resConflict.status).toBe(409);
      expect(conflictData.success).toBe(false);
      expect(conflictData.error.code).toBe("RESERVATION_CONFLICT");
    });

    it("allows safe idempotent re-release and re-finalization of reservations", async () => {
      const { user, store, variantId } = await createStoreWithProduct();

      await adjustStock(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}/adjust`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ quantityDelta: 20, reason: "RESTOCK" }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );

      const resCreate = await createReservation(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/reservations`,
          {
            method: "POST",
            headers: {
              cookie: user.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              variantId,
              quantity: 5,
              referenceType: "checkout",
              referenceId: "chk_re_release",
            }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const resData = await resCreate.json();
      const reservationId = resData.data.id;

      // First release
      const rel1 = await releaseReservation(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/reservations/${reservationId}/release`,
          {
            method: "POST",
            headers: { cookie: user.cookie },
          },
        ),
        { params: Promise.resolve({ storeId: store.id, reservationId }) },
      );
      expect(rel1.status).toBe(200);

      // Second release: safe retry, returns existing record without modifying stock again
      const rel2 = await releaseReservation(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/reservations/${reservationId}/release`,
          {
            method: "POST",
            headers: { cookie: user.cookie },
          },
        ),
        { params: Promise.resolve({ storeId: store.id, reservationId }) },
      );
      const rel2Data = await rel2.json();
      expect(rel2.status).toBe(200);
      expect(rel2Data.data.status).toBe("RELEASED");

      // Verify stock was only restored once: available = 20, reserved = 0
      const resItem = await getVariantInventory(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/inventory/${variantId}`,
          { headers: { cookie: user.cookie } },
        ),
        { params: Promise.resolve({ storeId: store.id, variantId }) },
      );
      const itemData = await resItem.json();
      expect(itemData.data.availableQuantity).toBe(20);
      expect(itemData.data.reservedQuantity).toBe(0);
    });
  });
});
