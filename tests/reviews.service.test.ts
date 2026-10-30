import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { StoreService } from "@calcart/stores";
import {
  DuplicateReviewError,
  ProductNotFoundError,
  ProductService,
  ReviewEligibilityError,
  ReviewForbiddenError,
  ReviewService,
} from "@calcart/products";
import { CustomerService } from "@calcart/customers";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Reviews Application Service Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const storeService = new StoreService();
  const productService = new ProductService();
  const reviewService = new ReviewService();
  const customerService = new CustomerService();

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

  async function createTestUser(db: Database, email = "merchant@example.com") {
    const userId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Merchant', 'scrypt:hash', 'ACTIVE')`,
      [userId, email],
    );
    return userId;
  }

  async function createTestStore(db: Database, userId: string, slug = "rev-store") {
    return await storeService.createStore(db, userId, {
      name: "Review Test Store",
      slug,
      currency: "USD",
      locale: "en-US",
      timezone: "America/New_York",
    });
  }

  async function createTestProduct(db: Database, storeId: string, slug = "silk-shirt") {
    return await productService.createProduct(db, storeId, {
      title: "Silk Shirt",
      slug,
      variants: [{ title: "M / White", price: 12000, inventoryQuantity: 50 }],
    });
  }

  async function createCustomerWithOrder(
    db: Database,
    storeId: string,
    productId: string,
    variantId: string,
    email = "buyer@example.com",
    paymentStatus = "PAID",
  ) {
    const customer = await customerService.createCustomer(db, storeId, {
      email,
      firstName: "Jane",
      lastName: "Doe",
    });

    const orderId = generateUuidV7();
    await db.query(
      `INSERT INTO orders (
        id, store_id, customer_id, order_number, status, payment_status,
        fulfillment_status, currency, total
      ) VALUES ($1, $2, $3, $4, 'CONFIRMED', $5, 'FULFILLED', 'USD', 12000)`,
      [orderId, storeId, customer.id, `ORD-${Date.now()}`, paymentStatus],
    );

    const itemId = generateUuidV7();
    await db.query(
      `INSERT INTO order_items (
        id, order_id, store_id, product_id, variant_id,
        product_name_snapshot, variant_name_snapshot, quantity, unit_price, line_total
      ) VALUES ($1, $2, $3, $4, $5, 'Silk Shirt', 'M / White', 1, 12000, 12000)`,
      [itemId, orderId, storeId, productId, variantId],
    );

    return { customer, orderId };
  }

  async function createCustomerWithMultiProductOrder(
    db: Database,
    storeId: string,
    items: Array<{ productId: string; variantId: string; price?: number }>,
    email = "multibuyer@example.com",
    paymentStatus = "PAID",
  ) {
    const customer = await customerService.createCustomer(db, storeId, {
      email,
      firstName: "Multi",
      lastName: "Shopper",
    });

    const orderId = generateUuidV7();
    const total = items.reduce((sum, item) => sum + (item.price ?? 10000), 0);
    await db.query(
      `INSERT INTO orders (
        id, store_id, customer_id, order_number, status, payment_status,
        fulfillment_status, currency, total
      ) VALUES ($1, $2, $3, $4, 'CONFIRMED', $5, 'FULFILLED', 'USD', $6)`,
      [orderId, storeId, customer.id, `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`, paymentStatus, total],
    );

    for (const item of items) {
      const itemId = generateUuidV7();
      await db.query(
        `INSERT INTO order_items (
          id, order_id, store_id, product_id, variant_id,
          product_name_snapshot, variant_name_snapshot, quantity, unit_price, line_total
        ) VALUES ($1, $2, $3, $4, $5, 'Product Item', 'Default', 1, $6, $6)`,
        [itemId, orderId, storeId, item.productId, item.variantId, item.price ?? 10000],
      );
    }

    return { customer, orderId };
  }

  it("checks eligibility: ineligibility for customers who haven't purchased", async () => {
    const db = await setupDb();
    const userId = await createTestUser(db);
    const store = await createTestStore(db, userId);
    const product = await createTestProduct(db, store.id);

    const nonBuyer = await customerService.createCustomer(db, store.id, {
      email: "browsing@example.com",
      firstName: "Bob",
      lastName: "Smith",
    });

    const eligibility = await reviewService.checkEligibility(
      db,
      store.id,
      product.id,
      nonBuyer.id,
    );

    expect(eligibility.canReview).toBe(false);
    expect(eligibility.isVerified).toBe(false);
    expect(eligibility.existingReview).toBeNull();
  });

  it("submits review: creates verified review for eligible buyer with pending status", async () => {
    const db = await setupDb();
    const userId = await createTestUser(db);
    const store = await createTestStore(db, userId);
    const product = await createTestProduct(db, store.id);
    const variantId = product.variants[0]!.id;

    const { customer } = await createCustomerWithOrder(
      db,
      store.id,
      product.id,
      variantId,
    );

    const review = await reviewService.submitReview(
      db,
      store.id,
      product.id,
      customer.id,
      {
        rating: 5,
        title: "Flawless drape and texture",
        content: "The fabric feels incredible and fits true to size. High grade finish.",
      },
    );

    expect(review.id).toBeDefined();
    expect(review.rating).toBe(5);
    expect(review.title).toBe("Flawless drape and texture");
    expect(review.isVerifiedPurchase).toBe(true);
    expect(review.status).toBe("PENDING");
    expect(review.customerName).toContain("Jane");
  });

  it("enforces duplicate review prevention for the same purchase", async () => {
    const db = await setupDb();
    const userId = await createTestUser(db);
    const store = await createTestStore(db, userId);
    const product = await createTestProduct(db, store.id);
    const variantId = product.variants[0]!.id;

    const { customer } = await createCustomerWithOrder(
      db,
      store.id,
      product.id,
      variantId,
    );

    await reviewService.submitReview(db, store.id, product.id, customer.id, {
      rating: 5,
      title: "First review",
      content: "Excellent quality.",
    });

    await expect(
      reviewService.submitReview(db, store.id, product.id, customer.id, {
        rating: 4,
        title: "Second attempt",
        content: "Trying to review again.",
      }),
    ).rejects.toThrow(DuplicateReviewError);
  });

  it("allows customer to update and delete their own review", async () => {
    const db = await setupDb();
    const userId = await createTestUser(db);
    const store = await createTestStore(db, userId);
    const product = await createTestProduct(db, store.id);
    const variantId = product.variants[0]!.id;

    const { customer } = await createCustomerWithOrder(
      db,
      store.id,
      product.id,
      variantId,
    );

    const created = await reviewService.submitReview(
      db,
      store.id,
      product.id,
      customer.id,
      {
        rating: 4,
        title: "Initial thoughts",
        content: "Good product overall.",
      },
    );

    const updated = await reviewService.updateCustomerReview(
      db,
      store.id,
      product.id,
      created.id,
      customer.id,
      {
        rating: 5,
        title: "Updated: Truly exceptional",
        content: "After washing, it holds up even better.",
      },
    );

    expect(updated.rating).toBe(5);
    expect(updated.title).toBe("Updated: Truly exceptional");

    // Another customer cannot delete
    const otherCustomer = await customerService.createCustomer(db, store.id, {
      email: "intruder@example.com",
      firstName: "Intruder",
      lastName: "User",
    });

    await expect(
      reviewService.deleteCustomerReview(
        db,
        store.id,
        product.id,
        created.id,
        otherCustomer.id,
      ),
    ).rejects.toThrow(ReviewForbiddenError);

    // Owner can delete
    await reviewService.deleteCustomerReview(
      db,
      store.id,
      product.id,
      created.id,
      customer.id,
    );

    const eligibility = await reviewService.checkEligibility(
      db,
      store.id,
      product.id,
      customer.id,
    );
    expect(eligibility.existingReview).toBeNull();
  });

  it("moderates reviews, records audit logs, and updates rating aggregates accurately", async () => {
    const db = await setupDb();
    const userId = await createTestUser(db);
    const store = await createTestStore(db, userId);
    const product = await createTestProduct(db, store.id);
    const variantId = product.variants[0]!.id;

    const { customer } = await createCustomerWithOrder(
      db,
      store.id,
      product.id,
      variantId,
    );

    const review = await reviewService.submitReview(
      db,
      store.id,
      product.id,
      customer.id,
      {
        rating: 5,
        title: "Loved it",
        content: "Worth every penny.",
      },
    );

    // Initial state: PENDING -> rating summary should be 0 (excludes unpublished)
    let summary = await reviewService.getProductReviewSummary(db, store.id, product.id);
    expect(summary.totalReviews).toBe(0);
    expect(summary.averageRating).toBe(0);

    // Merchant approves review -> PUBLISHED
    const moderated = await reviewService.moderateReview(
      db,
      store.id,
      review.id,
      userId,
      { status: "PUBLISHED" },
    );
    expect(moderated.status).toBe("PUBLISHED");
    expect(moderated.moderationLogs).toHaveLength(1);
    expect(moderated.moderationLogs![0]!.previousStatus).toBe("PENDING");
    expect(moderated.moderationLogs![0]!.newStatus).toBe("PUBLISHED");

    // Published summary should now show 1 review with 5.0 rating
    summary = await reviewService.getProductReviewSummary(db, store.id, product.id);
    expect(summary.totalReviews).toBe(1);
    expect(summary.averageRating).toBe(5);
    expect(summary.distribution[5]).toBe(1);

    // Merchant replies to the review
    const replied = await reviewService.replyToReview(
      db,
      store.id,
      review.id,
      userId,
      "Thank you for your generous feedback!",
    );
    expect(replied.merchantReply).toBe("Thank you for your generous feedback!");

    // Merchant rejects review with reason -> rating summary returns to 0
    await reviewService.moderateReview(db, store.id, review.id, userId, {
      status: "REJECTED",
      reason: "Failed policy review",
    });

    summary = await reviewService.getProductReviewSummary(db, store.id, product.id);
    expect(summary.totalReviews).toBe(0);
    expect(summary.averageRating).toBe(0);
  });

  it("allows a customer to review two different products from the same order", async () => {
    const db = await setupDb();
    const userId = await createTestUser(db);
    const store = await createTestStore(db, userId);

    const productA = await productService.createProduct(db, store.id, {
      title: "Leather Jacket",
      slug: "leather-jacket",
      variants: [{ title: "L / Black", price: 35000, inventoryQuantity: 10 }],
    });
    const productB = await productService.createProduct(db, store.id, {
      title: "Denim Jeans",
      slug: "denim-jeans",
      variants: [{ title: "32 / Indigo", price: 9500, inventoryQuantity: 20 }],
    });

    const { customer, orderId } = await createCustomerWithMultiProductOrder(
      db,
      store.id,
      [
        { productId: productA.id, variantId: productA.variants[0]!.id, price: 35000 },
        { productId: productB.id, variantId: productB.variants[0]!.id, price: 9500 },
      ],
      "dualbuyer@example.com",
    );

    // Review Product A from the order
    const reviewA = await reviewService.submitReview(
      db,
      store.id,
      productA.id,
      customer.id,
      {
        orderId,
        rating: 5,
        title: "Incredible craftsmanship",
        content: "Heavyweight leather, fits like a bespoke jacket.",
      },
    );
    expect(reviewA.id).toBeDefined();
    expect(reviewA.productId).toBe(productA.id);
    expect(reviewA.orderId).toBe(orderId);

    // Review Product B from the exact same order
    const reviewB = await reviewService.submitReview(
      db,
      store.id,
      productB.id,
      customer.id,
      {
        orderId,
        rating: 4,
        title: "Great denim cut",
        content: "Sturdy fabric, comfortable rise, nice deep indigo wash.",
      },
    );
    expect(reviewB.id).toBeDefined();
    expect(reviewB.productId).toBe(productB.id);
    expect(reviewB.orderId).toBe(orderId);
  });

  it("rejects a second review for the same product and order", async () => {
    const db = await setupDb();
    const userId = await createTestUser(db);
    const store = await createTestStore(db, userId);
    const product = await createTestProduct(db, store.id, "single-prod");
    const variantId = product.variants[0]!.id;

    const { customer, orderId } = await createCustomerWithOrder(
      db,
      store.id,
      product.id,
      variantId,
    );

    // First review succeeds
    await reviewService.submitReview(db, store.id, product.id, customer.id, {
      orderId,
      rating: 5,
      title: "First valid submission",
      content: "Excellent shirt.",
    });

    // Attempting a second review for the same product & order must be rejected
    await expect(
      reviewService.submitReview(db, store.id, product.id, customer.id, {
        orderId,
        rating: 4,
        title: "Duplicate attempt",
        content: "Trying to submit another review for the exact same order item.",
      }),
    ).rejects.toThrow(DuplicateReviewError);
  });

  it("rejects review referencing a product absent from the order", async () => {
    const db = await setupDb();
    const userId = await createTestUser(db);
    const store = await createTestStore(db, userId);

    const productInOrder = await productService.createProduct(db, store.id, {
      title: "Ordered Product",
      slug: "ordered-product",
      variants: [{ title: "Default", price: 5000, inventoryQuantity: 10 }],
    });
    const productNotInOrder = await productService.createProduct(db, store.id, {
      title: "Unordered Product",
      slug: "unordered-product",
      variants: [{ title: "Default", price: 8000, inventoryQuantity: 10 }],
    });

    const { customer, orderId } = await createCustomerWithOrder(
      db,
      store.id,
      productInOrder.id,
      productInOrder.variants[0]!.id,
    );

    // Submitting review for productNotInOrder with orderId of order containing only productInOrder
    await expect(
      reviewService.submitReview(db, store.id, productNotInOrder.id, customer.id, {
        orderId,
        rating: 5,
        title: "Sneaky review",
        content: "I did not buy this in this order.",
      }),
    ).rejects.toThrow(ReviewEligibilityError);
  });

  it("rejects cross-store review attempts", async () => {
    const db = await setupDb();
    const userId = await createTestUser(db);
    const storeA = await createTestStore(db, userId, "store-alpha");
    const storeB = await createTestStore(db, userId, "store-beta");

    const productA = await productService.createProduct(db, storeA.id, {
      title: "Alpha Exclusive",
      slug: "alpha-exclusive",
      variants: [{ title: "Standard", price: 10000, inventoryQuantity: 10 }],
    });

    const { customer, orderId } = await createCustomerWithOrder(
      db,
      storeA.id,
      productA.id,
      productA.variants[0]!.id,
    );

    // Attempting to submit review for Store A product in Store B context must fail
    await expect(
      reviewService.submitReview(db, storeB.id, productA.id, customer.id, {
        orderId,
        rating: 5,
        title: "Cross-store attack",
        content: "Attempting to post Store A review to Store B.",
      }),
    ).rejects.toThrow(ProductNotFoundError);
  });

  it("allows legitimate reviews for the same product from separate eligible orders (repeat purchases)", async () => {
    const db = await setupDb();
    const userId = await createTestUser(db);
    const store = await createTestStore(db, userId);
    const product = await createTestProduct(db, store.id, "coffee-beans");
    const variantId = product.variants[0]!.id;

    // First purchase
    const order1 = await createCustomerWithOrder(
      db,
      store.id,
      product.id,
      variantId,
      "repeatbuyer@example.com",
    );
    const customer = order1.customer;

    // Second purchase by same customer
    const order2Id = generateUuidV7();
    await db.query(
      `INSERT INTO orders (
        id, store_id, customer_id, order_number, status, payment_status,
        fulfillment_status, currency, total
      ) VALUES ($1, $2, $3, $4, 'CONFIRMED', 'PAID', 'FULFILLED', 'USD', 12000)`,
      [order2Id, store.id, customer.id, `ORD-REPEAT-${Date.now()}`],
    );
    await db.query(
      `INSERT INTO order_items (
        id, order_id, store_id, product_id, variant_id,
        product_name_snapshot, variant_name_snapshot, quantity, unit_price, line_total
      ) VALUES ($1, $2, $3, $4, $5, 'Silk Shirt', 'M / White', 1, 12000, 12000)`,
      [generateUuidV7(), order2Id, store.id, product.id, variantId],
    );

    // Review from first order
    const review1 = await reviewService.submitReview(db, store.id, product.id, customer.id, {
      orderId: order1.orderId,
      rating: 4,
      title: "First batch was good",
      content: "Satisfied with initial order.",
    });
    expect(review1.orderId).toBe(order1.orderId);

    // Review from second order
    const review2 = await reviewService.submitReview(db, store.id, product.id, customer.id, {
      orderId: order2Id,
      rating: 5,
      title: "Second batch was outstanding",
      content: "Even better roast this time around.",
    });
    expect(review2.orderId).toBe(order2Id);
    expect(review2.id).not.toBe(review1.id);
  });

  it("prevents concurrent duplicate submissions for the same product and order", async () => {
    const db = await setupDb();
    const userId = await createTestUser(db);
    const store = await createTestStore(db, userId);
    const product = await createTestProduct(db, store.id, "race-condition-prod");
    const variantId = product.variants[0]!.id;

    const { customer, orderId } = await createCustomerWithOrder(
      db,
      store.id,
      product.id,
      variantId,
    );

    // Fire 2 concurrent review submissions for the same order and product
    const results = await Promise.allSettled([
      reviewService.submitReview(db, store.id, product.id, customer.id, {
        orderId,
        rating: 5,
        title: "Concurrent review 1",
        content: "Testing concurrency 1.",
      }),
      reviewService.submitReview(db, store.id, product.id, customer.id, {
        orderId,
        rating: 5,
        title: "Concurrent review 2",
        content: "Testing concurrency 2.",
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one must succeed, and exactly one must fail
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(DuplicateReviewError);

    // Verify exactly 1 review exists in the database
    const dbCount = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM product_reviews WHERE store_id = $1 AND customer_id = $2 AND product_id = $3 AND order_id = $4`,
      [store.id, customer.id, product.id, orderId],
    );
    expect(dbCount.rows[0]?.count).toBe("1");
  });

  it("enforces unverified-review duplicate prevention", async () => {
    const db = await setupDb();
    const userId = await createTestUser(db);
    const store = await createTestStore(db, userId);
    const product = await createTestProduct(db, store.id, "unverified-prod");
    const customer = await customerService.createCustomer(db, store.id, {
      email: "unverified@example.com",
      firstName: "Unverified",
      lastName: "User",
    });

    const repo = new (await import("../modules/products/src/infrastructure/review-repository.js")).ReviewRepository();

    // Directly insert an unverified review (order_id = null)
    await repo.insertReview(db, {
      id: generateUuidV7(),
      storeId: store.id,
      productId: product.id,
      customerId: customer.id,
      orderId: null,
      variantId: null,
      rating: 4,
      title: "Unverified review",
      content: "Bought elsewhere.",
      status: "PENDING",
      isVerifiedPurchase: false,
      customerNameSnapshot: "Unverified User",
      customerEmailSnapshot: "unverified@example.com",
      merchantReply: null,
      merchantReplyAt: null,
      merchantReplyByUserId: null,
      moderatedAt: null,
      moderatedByUserId: null,
      moderationReason: null,
      reportCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Attempting to insert a second unverified review for the same product must violate unverified unique index
    await expect(
      repo.insertReview(db, {
        id: generateUuidV7(),
        storeId: store.id,
        productId: product.id,
        customerId: customer.id,
        orderId: null,
        variantId: null,
        rating: 3,
        title: "Duplicate unverified",
        content: "Trying to submit again.",
        status: "PENDING",
        isVerifiedPurchase: false,
        customerNameSnapshot: "Unverified User",
        customerEmailSnapshot: "unverified@example.com",
        merchantReply: null,
        merchantReplyAt: null,
        merchantReplyByUserId: null,
        moderatedAt: null,
        moderatedByUserId: null,
        moderationReason: null,
        reportCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).rejects.toThrow(DuplicateReviewError);
  });
});
