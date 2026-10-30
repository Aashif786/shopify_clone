import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@calcart/db";
import {
  CollectionService,
  DuplicateCollectionSlugError,
  ProductService,
} from "@calcart/products";
import { StoreService } from "@calcart/stores";
import { serializeSessionCookie } from "@calcart/auth";
import { createIsolatedDatabase } from "./helpers/postgres.js";
import { GET as getStorefrontCollections } from "../apps/web/app/api/v1/storefront/[storeSlug]/collections/route.js";
import { GET as getStorefrontCollectionDetail } from "../apps/web/app/api/v1/storefront/[storeSlug]/collections/[collectionSlug]/route.js";
import { GET as getStorefrontProducts } from "../apps/web/app/api/v1/storefront/[storeSlug]/products/route.js";
import {
  GET as getMerchantCollections,
  POST as postMerchantCollection,
} from "../apps/web/app/api/v1/stores/[storeId]/collections/route.js";
import {
  GET as getMerchantCollection,
  PATCH as patchMerchantCollection,
  DELETE as deleteMerchantCollection,
} from "../apps/web/app/api/v1/stores/[storeId]/collections/[collectionId]/route.js";
import {
  POST as postCollectionProduct,
} from "../apps/web/app/api/v1/stores/[storeId]/collections/[collectionId]/products/route.js";
import {
  DELETE as deleteCollectionProduct,
} from "../apps/web/app/api/v1/stores/[storeId]/collections/[collectionId]/products/[productId]/route.js";

declare global {
  var __calcart_web_db: unknown;
}

describe("Collections Domain & Storefront Integration", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();
  const productService = new ProductService();
  const collectionService = new CollectionService();

  let storeA: { id: string; slug: string };
  let storeB: { id: string; slug: string };
  let ownerATokenCookie: string;

  beforeAll(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__calcart_web_db = isolated.database;

    // Create owner and Store A
    const ownerAId = generateUuidV7();
    const sessionIdA = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Owner A', 'scrypt:hash', 'ACTIVE')`,
      [ownerAId, `owner-a-${Date.now()}@test.local`],
    );
    const expiresAt = new Date(Date.now() + 86400000);
    await db.query(
      `INSERT INTO sessions (id, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [sessionIdA, ownerAId, expiresAt],
    );
    ownerATokenCookie = serializeSessionCookie(sessionIdA, { expires: expiresAt });

    const sA = await storeService.createStore(db, ownerAId, {
      name: "Ceramics Emporium",
      slug: `ceramics-emporium-${Date.now()}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    await storeService.activateStore(db, sA.id, ownerAId);
    storeA = { id: sA.id, slug: sA.slug };

    // Create owner and Store B
    const ownerBId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Owner B', 'scrypt:hash', 'ACTIVE')`,
      [ownerBId, `owner-b-${Date.now()}@test.local`],
    );
    const sB = await storeService.createStore(db, ownerBId, {
      name: "Leather Goods",
      slug: `leather-goods-${Date.now()}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    await storeService.activateStore(db, sB.id, ownerBId);
    storeB = { id: sB.id, slug: sB.slug };
  });

  afterAll(async () => {
    global.__calcart_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  it("handles collection CRUD operations and enforces unique slugs per store", async () => {
    // 1. Create collection
    const summer = await collectionService.createCollection(db, storeA.id, {
      title: "Summer Collection",
      slug: "summer-collection",
      description: "Bright glazes and warm clay",
      status: "ACTIVE",
    });
    expect(summer.id).toBeDefined();
    expect(summer.title).toBe("Summer Collection");
    expect(summer.productCount).toBe(0);

    // 2. Reject duplicate slug within same store
    await expect(
      collectionService.createCollection(db, storeA.id, {
        title: "Summer Reprise",
        slug: "summer-collection",
      }),
    ).rejects.toThrow(DuplicateCollectionSlugError);

    // 3. Permit identical slug in Store B
    const storeBCol = await collectionService.createCollection(db, storeB.id, {
      title: "Summer Collection",
      slug: "summer-collection",
    });
    expect(storeBCol.id).toBeDefined();

    // 4. Retrieve collection by ID and slug
    const byId = await collectionService.getCollectionById(db, storeA.id, summer.id);
    expect(byId.title).toBe("Summer Collection");

    const bySlug = await collectionService.getCollectionBySlug(db, storeA.id, "summer-collection");
    expect(bySlug.id).toBe(summer.id);

    // 5. Update collection
    const updated = await collectionService.updateCollection(db, storeA.id, summer.id, {
      title: "Summer 2026 Collection",
      description: "Updated description",
    });
    expect(updated.title).toBe("Summer 2026 Collection");
    expect(updated.description).toBe("Updated description");

    // 6. Delete collection
    const deleted = await collectionService.deleteCollection(db, storeA.id, summer.id);
    expect(deleted).toBe(true);
  });

  it("assigns and unassigns products to collections with accurate product counts", async () => {
    const collection = await collectionService.createCollection(db, storeA.id, {
      title: "Handmade Mugs",
      slug: `handmade-mugs-${Date.now()}`,
    });

    const prod1 = await productService.createProduct(db, storeA.id, {
      title: "Espresso Cup",
      slug: `espresso-cup-${Date.now()}`,
      status: "ACTIVE",
      price: 1500,
    });
    const prod2 = await productService.createProduct(db, storeA.id, {
      title: "Latte Mug",
      slug: `latte-mug-${Date.now()}`,
      status: "ACTIVE",
      price: 2400,
    });

    // Add products
    await collectionService.addProductToCollection(db, storeA.id, collection.id, prod1.id, 0);
    await collectionService.addProductToCollection(db, storeA.id, collection.id, prod2.id, 1);

    // Verify product count in collection details
    const details = await collectionService.getCollectionById(db, storeA.id, collection.id);
    expect(details.productCount).toBe(2);

    // Verify product IDs list
    const productIds = await collectionService.listCollectionProductIds(db, storeA.id, collection.id);
    expect(productIds).toEqual([prod1.id, prod2.id]);

    // Remove one product
    const removed = await collectionService.removeProductFromCollection(
      db,
      storeA.id,
      collection.id,
      prod1.id,
    );
    expect(removed).toBe(true);

    const remaining = await collectionService.getCollectionById(db, storeA.id, collection.id);
    expect(remaining.productCount).toBe(1);
  });

  it("enforces strict tenant isolation preventing cross-store collection linkage", async () => {
    // Store A collection
    const colA = await collectionService.createCollection(db, storeA.id, {
      title: "Store A Collection",
      slug: `store-a-col-${Date.now()}`,
    });

    // Store B product
    const prodB = await productService.createProduct(db, storeB.id, {
      title: "Store B Product",
      slug: `store-b-prod-${Date.now()}`,
      status: "ACTIVE",
      price: 5000,
    });

    // Attempting to add Store B's product to Store A's collection must fail!
    await expect(
      collectionService.addProductToCollection(db, storeA.id, colA.id, prodB.id),
    ).rejects.toThrow();

    // Store B cannot access Store A's collection
    await expect(
      collectionService.getCollectionById(db, storeB.id, colA.id),
    ).rejects.toThrow();
  });

  it("integrates storefront collections endpoints and filters products by collection", async () => {
    // 1. Create two collections in Store A
    const cupsColSlug = `coffee-cups-${Date.now()}`;
    const mugsCol = await collectionService.createCollection(db, storeA.id, {
      title: "Coffee Cups",
      slug: cupsColSlug,
      description: "Vessels for great brew",
      status: "ACTIVE",
    });
    const platesCol = await collectionService.createCollection(db, storeA.id, {
      title: "Dinner Plates",
      slug: `dinner-plates-${Date.now()}`,
      description: "Handmade ceramic tableware",
      status: "ACTIVE",
    });

    // 2. Create products
    const cup = await productService.createProduct(db, storeA.id, {
      title: "Stoneware Cup",
      slug: `stoneware-cup-${Date.now()}`,
      status: "ACTIVE",
      price: 2000,
    });
    const plate = await productService.createProduct(db, storeA.id, {
      title: "Terracotta Plate",
      slug: `terracotta-plate-${Date.now()}`,
      status: "ACTIVE",
      price: 3500,
    });

    // Link cup to mugsCol, plate to platesCol
    await collectionService.addProductToCollection(db, storeA.id, mugsCol.id, cup.id);
    await collectionService.addProductToCollection(db, storeA.id, platesCol.id, plate.id);

    // 3. Test GET /api/v1/storefront/[storeSlug]/collections
    const reqCols = new Request(`http://localhost/api/v1/storefront/${storeA.slug}/collections`);
    const resCols = await getStorefrontCollections(reqCols, {
      params: Promise.resolve({ storeSlug: storeA.slug }),
    });
    expect(resCols.status).toBe(200);
    const bodyCols = await resCols.json();
    expect(bodyCols.success).toBe(true);
    expect(bodyCols.data.items.length).toBeGreaterThanOrEqual(2);

    // 4. Test GET /api/v1/storefront/[storeSlug]/collections/[collectionSlug]
    const reqDetail = new Request(
      `http://localhost/api/v1/storefront/${storeA.slug}/collections/${cupsColSlug}`,
    );
    const resDetail = await getStorefrontCollectionDetail(reqDetail, {
      params: Promise.resolve({ storeSlug: storeA.slug, collectionSlug: cupsColSlug }),
    });
    expect(resDetail.status).toBe(200);
    const bodyDetail = await resDetail.json();
    expect(bodyDetail.data.collection.title).toBe("Coffee Cups");
    expect(bodyDetail.data.collection.productCount).toBe(1);

    // 5. Test GET /api/v1/storefront/[storeSlug]/products?collection=[cupsColSlug]
    const reqProdFiltered = new Request(
      `http://localhost/api/v1/storefront/${storeA.slug}/products?collection=${cupsColSlug}`,
    );
    const resProdFiltered = await getStorefrontProducts(reqProdFiltered, {
      params: Promise.resolve({ storeSlug: storeA.slug }),
    });
    expect(resProdFiltered.status).toBe(200);
    const bodyFiltered = await resProdFiltered.json();
    expect(bodyFiltered.data.items).toHaveLength(1);
    expect(bodyFiltered.data.items[0].title).toBe("Stoneware Cup");
  });

  it("supports merchant collections API endpoints with authentication and role authorization", async () => {
    // 1. Merchant POST /api/v1/stores/[storeId]/collections
    const postReq = new Request(`http://localhost/api/v1/stores/${storeA.id}/collections`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: ownerATokenCookie,
      },
      body: JSON.stringify({
        title: "Autumn Essentials",
        description: "Cozy fall pieces",
      }),
    });
    const postRes = await postMerchantCollection(postReq, {
      params: Promise.resolve({ storeId: storeA.id }),
    });
    expect(postRes.status).toBe(201);
    const postBody = await postRes.json();
    expect(postBody.success).toBe(true);
    const collectionId = postBody.data.id;
    expect(collectionId).toBeDefined();

    // 2. Merchant GET /api/v1/stores/[storeId]/collections
    const getListReq = new Request(`http://localhost/api/v1/stores/${storeA.id}/collections`, {
      headers: { cookie: ownerATokenCookie },
    });
    const getListRes = await getMerchantCollections(getListReq, {
      params: Promise.resolve({ storeId: storeA.id }),
    });
    expect(getListRes.status).toBe(200);
    const listBody = await getListRes.json();
    expect(listBody.data.items.length).toBeGreaterThanOrEqual(1);

    // 3. Merchant GET collection detail
    const getReq = new Request(
      `http://localhost/api/v1/stores/${storeA.id}/collections/${collectionId}`,
      { headers: { cookie: ownerATokenCookie } },
    );
    const getRes = await getMerchantCollection(getReq, {
      params: Promise.resolve({ storeId: storeA.id, collectionId }),
    });
    expect(getRes.status).toBe(200);

    // 4. Merchant PATCH collection
    const patchReq = new Request(
      `http://localhost/api/v1/stores/${storeA.id}/collections/${collectionId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: ownerATokenCookie,
        },
        body: JSON.stringify({ title: "Winter Essentials" }),
      },
    );
    const patchRes = await patchMerchantCollection(patchReq, {
      params: Promise.resolve({ storeId: storeA.id, collectionId }),
    });
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.data.title).toBe("Winter Essentials");

    // 5. Merchant Add and Remove Product
    const testProduct = await productService.createProduct(db, storeA.id, {
      title: "Cozy Teapot",
      slug: `cozy-teapot-${Date.now()}`,
      status: "ACTIVE",
      price: 4000,
    });

    const addProdReq = new Request(
      `http://localhost/api/v1/stores/${storeA.id}/collections/${collectionId}/products`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: ownerATokenCookie,
        },
        body: JSON.stringify({ productId: testProduct.id }),
      },
    );
    const addProdRes = await postCollectionProduct(addProdReq, {
      params: Promise.resolve({ storeId: storeA.id, collectionId }),
    });
    expect(addProdRes.status).toBe(201);

    const removeProdReq = new Request(
      `http://localhost/api/v1/stores/${storeA.id}/collections/${collectionId}/products/${testProduct.id}`,
      {
        method: "DELETE",
        headers: { cookie: ownerATokenCookie },
      },
    );
    const removeProdRes = await deleteCollectionProduct(removeProdReq, {
      params: Promise.resolve({ storeId: storeA.id, collectionId, productId: testProduct.id }),
    });
    expect(removeProdRes.status).toBe(200);

    // 6. Merchant DELETE collection
    const delReq = new Request(
      `http://localhost/api/v1/stores/${storeA.id}/collections/${collectionId}`,
      {
        method: "DELETE",
        headers: { cookie: ownerATokenCookie },
      },
    );
    const delRes = await deleteMerchantCollection(delReq, {
      params: Promise.resolve({ storeId: storeA.id, collectionId }),
    });
    expect(delRes.status).toBe(200);
  });
});
