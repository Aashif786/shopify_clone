import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { StoreService } from "@shopify-clone/stores";
import { ProductService, ReviewService } from "@shopify-clone/products";
import { CustomerService } from "@shopify-clone/customers";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Review Tenant Isolation & Multi-Store Security Boundaries", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();
  const productService = new ProductService();
  const reviewService = new ReviewService();
  const customerService = new CustomerService();

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
  });

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function createTestUser(email: string) {
    const userId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Merchant', 'scrypt:hash', 'ACTIVE')`,
      [userId, email],
    );
    return userId;
  }

  it("strictly isolates product reviews across distinct store tenants", async () => {
    const userA = await createTestUser("ownerA@example.com");
    const userB = await createTestUser("ownerB@example.com");

    const storeA = await storeService.createStore(db, userA, {
      name: "Store Alpha",
      slug: "store-alpha",
      currency: "USD",
      locale: "en-US",
      timezone: "America/New_York",
    });

    const storeB = await storeService.createStore(db, userB, {
      name: "Store Beta",
      slug: "store-beta",
      currency: "USD",
      locale: "en-US",
      timezone: "America/New_York",
    });

    const prodA = await productService.createProduct(db, storeA.id, {
      title: "Alpha Watch",
      slug: "alpha-watch",
      variants: [{ title: "Default", price: 20000 }],
    });

    const prodB = await productService.createProduct(db, storeB.id, {
      title: "Beta Watch",
      slug: "beta-watch",
      variants: [{ title: "Default", price: 25000 }],
    });

    // Customer in Store A purchases product in Store A
    const custA = await customerService.createCustomer(db, storeA.id, {
      email: "buyer@alpha.com",
      firstName: "Alice",
      lastName: "A",
    });

    const orderAId = generateUuidV7();
    await db.query(
      `INSERT INTO orders (id, store_id, customer_id, order_number, status, payment_status, currency, total)
       VALUES ($1, $2, $3, 'ORD-A-1', 'CONFIRMED', 'PAID', 'USD', 20000)`,
      [orderAId, storeA.id, custA.id],
    );
    await db.query(
      `INSERT INTO order_items (id, order_id, store_id, product_id, variant_id, product_name_snapshot, variant_name_snapshot, quantity, unit_price, line_total)
       VALUES ($1, $2, $3, $4, $5, 'Alpha Watch', 'Default', 1, 20000, 20000)`,
      [generateUuidV7(), orderAId, storeA.id, prodA.id, prodA.variants[0]!.id],
    );

    // Alice writes review for Store A
    const revA = await reviewService.submitReview(
      db,
      storeA.id,
      prodA.id,
      custA.id,
      {
        rating: 5,
        title: "Phenomenal piece",
        content: "Exceeded all expectations.",
      },
      { autoPublish: true },
    );

    // 1. Store A listing returns review
    const listA = await reviewService.listPublishedReviews(db, storeA.id, prodA.id);
    expect(listA.items).toHaveLength(1);
    expect(listA.items[0]!.id).toBe(revA.id);

    // 2. Store B cannot see review under Store B
    const listB = await reviewService.listPublishedReviews(db, storeB.id, prodB.id);
    expect(listB.items).toHaveLength(0);

    // 3. Store B merchant listing does NOT include Store A's reviews
    const merchantListB = await reviewService.listMerchantReviews(db, storeB.id);
    expect(merchantListB.items).toHaveLength(0);
    expect(merchantListB.stats.total).toBe(0);

    // 4. Store B merchant cannot access or moderate Store A's review
    const detailB = await reviewService.getMerchantReviewById(db, storeB.id, revA.id).catch((e) => e);
    expect(detailB).toBeInstanceOf(Error);

    // 5. Cross-store moderation attempt by Store B fails
    await expect(
      reviewService.moderateReview(db, storeB.id, revA.id, userB, { status: "REJECTED" }),
    ).rejects.toThrow();

    // 6. Cross-store customer purchase cannot be used to review another store's product
    await expect(
      reviewService.submitReview(db, storeB.id, prodB.id, custA.id, {
        rating: 5,
        title: "Trying to cross-review",
        content: "Should be blocked.",
      }),
    ).rejects.toThrow();
  });
});
