import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@calcart/db";
import { serializeSessionCookie } from "@calcart/auth";
import { StoreService } from "@calcart/stores";
import { createIsolatedDatabase } from "./helpers/postgres.js";

import {
  GET as getProducts,
  POST as postProduct,
} from "../apps/web/app/api/v1/stores/[storeId]/products/route.js";
import {
  GET as getProduct,
  PATCH as patchProduct,
} from "../apps/web/app/api/v1/stores/[storeId]/products/[productId]/route.js";
import { POST as publishProduct } from "../apps/web/app/api/v1/stores/[storeId]/products/[productId]/publish/route.js";
import { POST as unpublishProduct } from "../apps/web/app/api/v1/stores/[storeId]/products/[productId]/unpublish/route.js";
import { POST as archiveProduct } from "../apps/web/app/api/v1/stores/[storeId]/products/[productId]/archive/route.js";
import {
  GET as getVariants,
  POST as postVariant,
} from "../apps/web/app/api/v1/stores/[storeId]/products/[productId]/variants/route.js";
import {
  DELETE as deleteVariant,
  PATCH as patchVariant,
} from "../apps/web/app/api/v1/stores/[storeId]/products/[productId]/variants/[variantId]/route.js";
import {
  GET as getOptions,
  PUT as putOptions,
} from "../apps/web/app/api/v1/stores/[storeId]/products/[productId]/options/route.js";
import {
  PATCH as patchBatchVariants,
} from "../apps/web/app/api/v1/stores/[storeId]/products/[productId]/variants/batch/route.js";

declare global {
  var __calcart_web_db: unknown;
}

describe("Products API Endpoints (/api/v1/stores/[storeId]/products/*)", { timeout: 30_000 }, () => {
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

  describe("POST /api/v1/stores/[storeId]/products", () => {
    it("rejects unauthenticated request with 401 AUTHENTICATION_REQUIRED", async () => {
      const { store } = await createStoreWithOwner();
      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Unauthenticated Product" }),
      });

      const res = await postProduct(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("returns 404 NOT_FOUND when accessed by user with no membership (tenant-safe)", async () => {
      const { store } = await createStoreWithOwner("owner@test.com");
      const stranger = await createAuthenticatedUser("stranger@other.com");

      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: stranger.cookie,
        },
        body: JSON.stringify({ title: "Sneaky Product" }),
      });

      const res = await postProduct(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("rejects staff member with 403 FORBIDDEN when attempting product creation", async () => {
      const { user: owner, store } = await createStoreWithOwner("owner@test.com");
      const staff = await createAuthenticatedUser("staff@test.com");

      await storeService.addStoreMember(db, store.id, owner.userId, {
        userId: staff.userId,
        role: "staff",
      });

      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: staff.cookie,
        },
        body: JSON.stringify({ title: "Staff Attempted Product" }),
      });

      const res = await postProduct(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("creates a product and returns 201 with ProductDetail DTO", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      const req = new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: owner.cookie,
        },
        body: JSON.stringify({
          title: "Wool Beanie",
          description: "Warm knitted winter hat",
          slug: "wool-beanie",
          price: 2500,
          compareAtPrice: 3000,
          sku: "BEANIE-001",
        }),
      });

      const res = await postProduct(req, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.storeId).toBe(store.id);
      expect(body.data.title).toBe("Wool Beanie");
      expect(body.data.slug).toBe("wool-beanie");
      expect(body.data.status).toBe("DRAFT");
      expect(body.data.variants).toHaveLength(1);
      expect(body.data.variants[0].sku).toBe("BEANIE-001");
      expect(body.data.variants[0].price).toBe(2500);
      expect(body.data.variants[0].compareAtPrice).toBe(3000);
    });

    it("rejects duplicate slug with 409 PRODUCT_SLUG_CONFLICT", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      const firstReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: owner.cookie,
        },
        body: JSON.stringify({ title: "Cap", slug: "cap" }),
      });
      await postProduct(firstReq, { params: Promise.resolve({ storeId: store.id }) });

      const dupeReq = new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: owner.cookie,
        },
        body: JSON.stringify({ title: "Another Cap", slug: "cap" }),
      });
      const res = await postProduct(dupeReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe("PRODUCT_SLUG_CONFLICT");
    });

    it("lists products via GET with pagination and status filtering", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      await postProduct(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ title: "Product Alpha", status: "ACTIVE" }),
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );

      await postProduct(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ title: "Product Beta", status: "DRAFT" }),
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );

      const listRes = await getProducts(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products?limit=10`, {
          headers: { cookie: owner.cookie },
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      expect(listRes.status).toBe(200);
      const listBody = await listRes.json();
      expect(listBody.success).toBe(true);
      expect(listBody.data.items).toHaveLength(2);

      const filteredRes = await getProducts(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products?status=ACTIVE`, {
          headers: { cookie: owner.cookie },
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      expect(filteredRes.status).toBe(200);
      const filteredBody = await filteredRes.json();
      expect(filteredBody.data.items).toHaveLength(1);
      expect(filteredBody.data.items[0].title).toBe("Product Alpha");
    });
  });

  describe("GET and PATCH /api/v1/stores/[storeId]/products/[productId]", () => {
    it("retrieves product by ID and allows staff access", async () => {
      const { user: owner, store } = await createStoreWithOwner("owner@test.com");
      const staff = await createAuthenticatedUser("staff@test.com");

      await storeService.addStoreMember(db, store.id, owner.userId, {
        userId: staff.userId,
        role: "staff",
      });

      // Create product as owner
      const createRes = await postProduct(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ title: "Ceramic Plate", price: 1800 }),
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const created = (await createRes.json()).data;

      // Get product as staff
      const getRes = await getProduct(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products/${created.id}`, {
          headers: { cookie: staff.cookie },
        }),
        { params: Promise.resolve({ storeId: store.id, productId: created.id }) },
      );
      expect(getRes.status).toBe(200);
      const getBody = await getRes.json();
      expect(getBody.data.id).toBe(created.id);
      expect(getBody.data.title).toBe("Ceramic Plate");
    });

    it("updates product attributes via PATCH", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      const createRes = await postProduct(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ title: "Old Name", slug: "old-name" }),
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const created = (await createRes.json()).data;

      const patchRes = await patchProduct(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products/${created.id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({
            title: "New Name",
            description: "Updated description",
          }),
        }),
        { params: Promise.resolve({ storeId: store.id, productId: created.id }) },
      );
      expect(patchRes.status).toBe(200);
      const patchBody = await patchRes.json();
      expect(patchBody.data.title).toBe("New Name");
      expect(patchBody.data.description).toBe("Updated description");
    });
  });

  describe("Lifecycle Endpoints (publish, unpublish, archive)", () => {
    it("publishes, unpublishes, and archives a product via explicit transition routes", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      const createRes = await postProduct(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ title: "Leather Boots", price: 15000 }),
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const created = (await createRes.json()).data;
      expect(created.status).toBe("DRAFT");

      // Publish
      const pubRes = await publishProduct(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products/${created.id}/publish`, {
          method: "POST",
          headers: { cookie: owner.cookie },
        }),
        { params: Promise.resolve({ storeId: store.id, productId: created.id }) },
      );
      expect(pubRes.status).toBe(200);
      expect((await pubRes.json()).data.status).toBe("ACTIVE");

      // Unpublish
      const unpubRes = await unpublishProduct(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products/${created.id}/unpublish`, {
          method: "POST",
          headers: { cookie: owner.cookie },
        }),
        { params: Promise.resolve({ storeId: store.id, productId: created.id }) },
      );
      expect(unpubRes.status).toBe(200);
      expect((await unpubRes.json()).data.status).toBe("DRAFT");

      // Publish again then Archive
      await publishProduct(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products/${created.id}/publish`, {
          method: "POST",
          headers: { cookie: owner.cookie },
        }),
        { params: Promise.resolve({ storeId: store.id, productId: created.id }) },
      );

      const archRes = await archiveProduct(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products/${created.id}/archive`, {
          method: "POST",
          headers: { cookie: owner.cookie },
        }),
        { params: Promise.resolve({ storeId: store.id, productId: created.id }) },
      );
      expect(archRes.status).toBe(200);
      expect((await archRes.json()).data.status).toBe("ARCHIVED");
    });
  });

  describe("Variants Endpoints (/variants and /variants/[variantId])", () => {
    it("adds variant, updates it, and prevents deleting last remaining variant", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      const createRes = await postProduct(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({ title: "Custom Poster", price: 2000 }),
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const product = (await createRes.json()).data;
      const initialVariant = product.variants[0];

      // Add variant
      const addVarRes = await postVariant(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products/${product.id}/variants`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({
            title: "Framed 18x24",
            price: 5000,
            sku: "POSTER-18X24",
          }),
        }),
        { params: Promise.resolve({ storeId: store.id, productId: product.id }) },
      );
      expect(addVarRes.status).toBe(201);
      const addedVariant = (await addVarRes.json()).data;
      expect(addedVariant.title).toBe("Framed 18x24");
      expect(addedVariant.price).toBe(5000);

      // List variants
      const listVarsRes = await getVariants(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products/${product.id}/variants`, {
          headers: { cookie: owner.cookie },
        }),
        { params: Promise.resolve({ storeId: store.id, productId: product.id }) },
      );
      expect(listVarsRes.status).toBe(200);
      expect((await listVarsRes.json()).data.items).toHaveLength(2);

      // Update variant
      const patchVarRes = await patchVariant(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/products/${product.id}/variants/${addedVariant.id}`,
          {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              cookie: owner.cookie,
            },
            body: JSON.stringify({ price: 4800 }),
          },
        ),
        {
          params: Promise.resolve({
            storeId: store.id,
            productId: product.id,
            variantId: addedVariant.id,
          }),
        },
      );
      expect(patchVarRes.status).toBe(200);
      expect((await patchVarRes.json()).data.price).toBe(4800);

      // Delete added variant
      const delVarRes = await deleteVariant(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/products/${product.id}/variants/${addedVariant.id}`,
          {
            method: "DELETE",
            headers: { cookie: owner.cookie },
          },
        ),
        {
          params: Promise.resolve({
            storeId: store.id,
            productId: product.id,
            variantId: addedVariant.id,
          }),
        },
      );
      expect(delVarRes.status).toBe(200);

      // Attempting to delete the last remaining variant must return 400 CANNOT_DELETE_LAST_VARIANT
      const delLastRes = await deleteVariant(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/products/${product.id}/variants/${initialVariant.id}`,
          {
            method: "DELETE",
            headers: { cookie: owner.cookie },
          },
        ),
        {
          params: Promise.resolve({
            storeId: store.id,
            productId: product.id,
            variantId: initialVariant.id,
          }),
        },
      );
      expect(delLastRes.status).toBe(400);
      expect((await delLastRes.json()).error.code).toBe("CANNOT_DELETE_LAST_VARIANT");
    });

    it("manages product options via PUT /options and lists them via GET /options", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      // Create product
      const createRes = await postProduct(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({
            title: "Vintage Denim Jacket",
            price: 8900,
            sku: "DENIM-001",
          }),
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const product = (await createRes.json()).data;

      // Set options
      const putRes = await putOptions(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/products/${product.id}/options`,
          {
            method: "PUT",
            headers: {
              "content-type": "application/json",
              cookie: owner.cookie,
            },
            body: JSON.stringify({
              options: [
                { name: "Size", position: 0, values: ["S", "M", "L"] },
                { name: "Wash", position: 1, values: ["Light", "Dark"] },
              ],
            }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, productId: product.id }) },
      );

      expect(putRes.status).toBe(200);
      const putBody = await putRes.json();
      expect(putBody.success).toBe(true);
      expect(putBody.data.items).toHaveLength(2);
      expect(putBody.data.items[0].name).toBe("Size");
      expect(putBody.data.items[0].values).toEqual(["S", "M", "L"]);

      // Get options
      const getRes = await getOptions(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/products/${product.id}/options`,
          {
            headers: { cookie: owner.cookie },
          },
        ),
        { params: Promise.resolve({ storeId: store.id, productId: product.id }) },
      );

      expect(getRes.status).toBe(200);
      const getBody = await getRes.json();
      expect(getBody.data.items).toHaveLength(2);
    });

    it("batch updates variants via PATCH /variants/batch", async () => {
      const { user: owner, store } = await createStoreWithOwner();

      // Create product with 2 variants
      const createRes = await postProduct(
        new Request(`http://localhost:3000/api/v1/stores/${store.id}/products`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookie,
          },
          body: JSON.stringify({
            title: "Anime Poster",
            price: 1500,
            variants: [
              { title: "A4", price: 1500, sku: "POSTER-A4", position: 0 },
              { title: "A3", price: 2500, sku: "POSTER-A3", position: 1 },
            ],
          }),
        }),
        { params: Promise.resolve({ storeId: store.id }) },
      );
      const product = (await createRes.json()).data;
      const v0 = product.variants[0];
      const v1 = product.variants[1];

      // Batch update prices and SKUs
      const batchRes = await patchBatchVariants(
        new Request(
          `http://localhost:3000/api/v1/stores/${store.id}/products/${product.id}/variants/batch`,
          {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              cookie: owner.cookie,
            },
            body: JSON.stringify({
              variants: [
                { id: v0.id, price: 1800, sku: "POSTER-A4-V2" },
                { id: v1.id, price: 2800, compareAtPrice: 3500 },
              ],
            }),
          },
        ),
        { params: Promise.resolve({ storeId: store.id, productId: product.id }) },
      );

      expect(batchRes.status).toBe(200);
      const batchBody = await batchRes.json();
      expect(batchBody.success).toBe(true);
      expect(batchBody.data.items).toHaveLength(2);

      const updatedV0 = batchBody.data.items.find((v: { id: string }) => v.id === v0.id);
      expect(updatedV0.price).toBe(1800);
      expect(updatedV0.sku).toBe("POSTER-A4-V2");

      const updatedV1 = batchBody.data.items.find((v: { id: string }) => v.id === v1.id);
      expect(updatedV1.price).toBe(2800);
      expect(updatedV1.compareAtPrice).toBe(3500);
    });
  });
});
