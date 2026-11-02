import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@calcart/db";
import { CustomerService, WishlistService } from "@calcart/customers";
import { ProductService } from "@calcart/products";
import { StoreService } from "@calcart/stores";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Storefront Customer Wishlist Integration", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();
  const customerService = new CustomerService();
  const productService = new ProductService();
  const wishlistService = new WishlistService();

  let storeA: { id: string; slug: string };
  let storeB: { id: string; slug: string };
  let customerA: { id: string; userId: string };
  let customerB: { id: string; userId: string };

  let product1: { id: string; variantId: string };
  let product2: { id: string; variantId: string };
  let product3: { id: string; variantId: string };

  beforeAll(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;

    // 1. Create Store A
    const userAId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Owner A', 'scrypt:hash', 'ACTIVE')`,
      [userAId, `owner-a-${Date.now()}@test.local`],
    );
    const sA = await storeService.createStore(db, userAId, {
      name: "Wishlist Test Store A",
      slug: `wishlist-store-a-${Date.now()}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    await storeService.activateStore(db, sA.id, userAId);
    storeA = { id: sA.id, slug: sA.slug };

    // 2. Create Store B (for tenant isolation)
    const userBId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Owner B', 'scrypt:hash', 'ACTIVE')`,
      [userBId, `owner-b-${Date.now()}@test.local`],
    );
    const sB = await storeService.createStore(db, userBId, {
      name: "Wishlist Test Store B",
      slug: `wishlist-store-b-${Date.now()}`,
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
    });
    await storeService.activateStore(db, sB.id, userBId);
    storeB = { id: sB.id, slug: sB.slug };

    // 3. Create Customers
    const custUserAId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Customer A', 'scrypt:hash', 'ACTIVE')`,
      [custUserAId, `cust-a-${Date.now()}@test.local`],
    );
    const cA = await customerService.createCustomer(db, storeA.id, {
      email: `cust-a-${Date.now()}@test.local`,
      firstName: "Customer",
      lastName: "A",
      userId: custUserAId,
    });
    customerA = { id: cA.id, userId: custUserAId };

    const custUserBId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Customer B', 'scrypt:hash', 'ACTIVE')`,
      [custUserBId, `cust-b-${Date.now()}@test.local`],
    );
    const cB = await customerService.createCustomer(db, storeB.id, {
      email: `cust-b-${Date.now()}@test.local`,
      firstName: "Customer",
      lastName: "B",
      userId: custUserBId,
    });
    customerB = { id: cB.id, userId: custUserBId };

    // 4. Create Products in Store A
    const p1 = await productService.createProduct(db, storeA.id, {
      title: "Oversized Heavyweight Hoodie",
      status: "ACTIVE",
      price: 8500,
      compareAtPrice: 11000,
      sku: "HOODIE-BLK-01",
    });
    product1 = { id: p1.id, variantId: p1.variants[0]!.id };

    const p2 = await productService.createProduct(db, storeA.id, {
      title: "Acid-Wash Graphic Tee",
      status: "ACTIVE",
      price: 4500,
      sku: "TEE-ACID-02",
    });
    product2 = { id: p2.id, variantId: p2.variants[0]!.id };

    const p3 = await productService.createProduct(db, storeA.id, {
      title: "Cargo Skate Trousers",
      status: "ACTIVE",
      price: 9500,
      sku: "CARGO-GRN-03",
    });
    product3 = { id: p3.id, variantId: p3.variants[0]!.id };
  });

  afterAll(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  it("adds an item to customer wishlist and lists enriched details", async () => {
    const item = await wishlistService.addItem(
      db,
      storeA.id,
      customerA.id,
      product1.id,
      product1.variantId,
    );
    expect(item).toBeDefined();
    expect(item.productId).toBe(product1.id);
    expect(item.variantId).toBe(product1.variantId);

    const list = await wishlistService.listWishlistItems(db, storeA.id, customerA.id);
    expect(list.length).toBe(1);
    expect(list[0]!.productTitle).toBe("Oversized Heavyweight Hoodie");
    expect(list[0]!.price).toBe(8500);
    expect(list[0]!.compareAtPrice).toBe(11000);
    expect(list[0]!.currency).toBe("USD");
  });

  it("handles duplicate add gracefully by returning existing item", async () => {
    const itemDup = await wishlistService.addItem(
      db,
      storeA.id,
      customerA.id,
      product1.id,
      product1.variantId,
    );
    expect(itemDup).toBeDefined();

    const count = await wishlistService.countWishlistItems(db, storeA.id, customerA.id);
    expect(count).toBe(1);
  });

  it("adds second item and retrieves multiple items ordered by created_at DESC", async () => {
    await wishlistService.addItem(
      db,
      storeA.id,
      customerA.id,
      product2.id,
      product2.variantId,
    );

    const list = await wishlistService.listWishlistItems(db, storeA.id, customerA.id);
    expect(list.length).toBe(2);
    expect(list[0]!.productId).toBe(product2.id); // Latest first
    expect(list[1]!.productId).toBe(product1.id);
  });

  it("removes item by product and variant", async () => {
    const removed = await wishlistService.removeItem(
      db,
      storeA.id,
      customerA.id,
      product1.id,
      product1.variantId,
    );
    expect(removed).toBe(true);

    const count = await wishlistService.countWishlistItems(db, storeA.id, customerA.id);
    expect(count).toBe(1);
  });

  it("removes item by item ID", async () => {
    const list = await wishlistService.listWishlistItems(db, storeA.id, customerA.id);
    expect(list.length).toBe(1);

    const removed = await wishlistService.removeItemById(
      db,
      storeA.id,
      customerA.id,
      list[0]!.id,
    );
    expect(removed).toBe(true);

    const count = await wishlistService.countWishlistItems(db, storeA.id, customerA.id);
    expect(count).toBe(0);
  });

  it("merges guest wishlist items into customer wishlist upon login", async () => {
    const guestItems = [
      { productId: product1.id, variantId: product1.variantId },
      { productId: product3.id, variantId: product3.variantId },
    ];

    const mergedCount = await wishlistService.mergeGuestWishlist(
      db,
      storeA.id,
      customerA.id,
      guestItems,
    );
    expect(mergedCount).toBe(2);

    const list = await wishlistService.listWishlistItems(db, storeA.id, customerA.id);
    expect(list.length).toBe(2);
    const productIds = list.map((i) => i.productId);
    expect(productIds).toContain(product1.id);
    expect(productIds).toContain(product3.id);
  });

  it("batch resolves items for guest wishlist display", async () => {
    const guestItems = [
      { productId: product2.id, variantId: product2.variantId },
      { productId: product3.id, variantId: product3.variantId },
    ];

    const resolved = await wishlistService.batchResolveItems(db, storeA.id, guestItems);
    expect(resolved.length).toBe(2);
    expect(resolved.some((r) => r.productTitle === "Acid-Wash Graphic Tee")).toBe(true);
    expect(resolved.some((r) => r.productTitle === "Cargo Skate Trousers")).toBe(true);
  });

  it("clears all items from customer wishlist", async () => {
    const cleared = await wishlistService.clearWishlist(db, storeA.id, customerA.id);
    expect(cleared).toBeGreaterThanOrEqual(1);

    const count = await wishlistService.countWishlistItems(db, storeA.id, customerA.id);
    expect(count).toBe(0);
  });

  it("enforces multi-tenant isolation across stores", async () => {
    // Add product1 to Store A customer
    await wishlistService.addItem(
      db,
      storeA.id,
      customerA.id,
      product1.id,
      product1.variantId,
    );

    // Store B customer querying their wishlist should see 0
    const storeBList = await wishlistService.listWishlistItems(db, storeB.id, customerB.id);
    expect(storeBList.length).toBe(0);

    // Attempting to query Store A customer with Store B store_id returns 0
    const crossStoreList = await wishlistService.listWishlistItems(db, storeB.id, customerA.id);
    expect(crossStoreList.length).toBe(0);

    // Attempting to remove Store A item using Store B store_id does not remove it
    const crossRemove = await wishlistService.removeItem(
      db,
      storeB.id,
      customerA.id,
      product1.id,
      product1.variantId,
    );
    expect(crossRemove).toBe(false);

    // Store A item still intact
    const storeAList = await wishlistService.listWishlistItems(db, storeA.id, customerA.id);
    expect(storeAList.length).toBe(1);
  });
});
