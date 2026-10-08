import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { StoreService } from "@shopify-clone/stores";
import { ProductNotFoundError, ProductService } from "@shopify-clone/products";
import { requireStoreAccess, ForbiddenError } from "@shopify-clone/tenant";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Products Tenant Isolation & Authorization Boundary", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const storeService = new StoreService();
  const productService = new ProductService();

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function setupDb() {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    return isolated.database;
  }

  async function createTestUser(db: Database, email: string) {
    const userId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'User', 'scrypt:hash', 'ACTIVE')`,
      [userId, email],
    );
    return userId;
  }

  it("permits store owner to create and access products in their store", async () => {
    const db = await setupDb();
    const ownerId = await createTestUser(db, "owner@store-a.com");
    const storeA = await storeService.createStore(db, ownerId, {
      name: "Store Alpha",
      slug: "store-alpha",
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });

    // Check store access
    const membership = await requireStoreAccess(db, storeA.id, ownerId, "admin");
    expect(membership.role).toBe("owner");

    const product = await productService.createProduct(db, storeA.id, {
      title: "Alpha Product",
      price: 1500,
    });

    const retrieved = await productService.getProductById(db, storeA.id, product.id);
    expect(retrieved.id).toBe(product.id);
    expect(retrieved.storeId).toBe(storeA.id);
  });

  it("strictly prevents cross-store product access between independent store tenants", async () => {
    const db = await setupDb();
    const ownerAId = await createTestUser(db, "owner-a@tenant.com");
    const ownerBId = await createTestUser(db, "owner-b@tenant.com");

    const storeA = await storeService.createStore(db, ownerAId, {
      name: "Tenant A Store",
      slug: "tenant-a-store",
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });

    const storeB = await storeService.createStore(db, ownerBId, {
      name: "Tenant B Store",
      slug: "tenant-b-store",
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });

    // Create product in Store B
    const productB = await productService.createProduct(db, storeB.id, {
      title: "Secret Product B",
      slug: "secret-product-b",
      price: 9900,
    });

    // Attempting to query Product B using Store A's context must return ProductNotFoundError
    // (Never leaking whether Product B exists)
    await expect(
      productService.getProductById(db, storeA.id, productB.id),
    ).rejects.toThrow(ProductNotFoundError);

    await expect(
      productService.getProductBySlug(db, storeA.id, "secret-product-b"),
    ).rejects.toThrow(ProductNotFoundError);

    // Attempting to list products for Store A must not return Store B products
    const listA = await productService.listProducts(db, storeA.id);
    expect(listA.items).toHaveLength(0);
  });

  it("rejects non-members from accessing store products", async () => {
    const db = await setupDb();
    const ownerId = await createTestUser(db, "owner@mystore.com");
    const strangerId = await createTestUser(db, "stranger@other.com");

    const store = await storeService.createStore(db, ownerId, {
      name: "My Store",
      slug: "my-store",
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });

    // Stranger has no membership in store
    await expect(
      requireStoreAccess(db, store.id, strangerId, "staff"),
    ).rejects.toThrow(ForbiddenError);
  });

  it("enforces role permissions: staff members can view but cannot perform mutations", async () => {
    const db = await setupDb();
    const ownerId = await createTestUser(db, "owner@retail.com");
    const staffId = await createTestUser(db, "staff@retail.com");

    const store = await storeService.createStore(db, ownerId, {
      name: "Retail Store",
      slug: "retail-store",
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });

    // Add staff member
    await storeService.addStoreMember(db, store.id, ownerId, {
      userId: staffId,
      role: "staff",
    });

    // Staff member has at least "staff" permission (read-only)
    const staffMembership = await requireStoreAccess(db, store.id, staffId, "staff");
    expect(staffMembership.role).toBe("staff");

    // Staff member attempting admin-required action is denied by tenant boundary
    await expect(
      requireStoreAccess(db, store.id, staffId, "admin"),
    ).rejects.toThrow(ForbiddenError);
  });
});
