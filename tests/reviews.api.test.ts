import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { serializeSessionCookie } from "@calcart/auth";
import { StoreService } from "@calcart/stores";
import { ProductService } from "@calcart/products";
import { CustomerService } from "@calcart/customers";
import { createIsolatedDatabase } from "./helpers/postgres.js";

import {
  GET as getStorefrontReviews,
  POST as postStorefrontReview,
} from "../apps/web/app/api/v1/storefront/[storeSlug]/products/[productSlug]/reviews/route.js";
import {
  GET as getEligibility,
} from "../apps/web/app/api/v1/storefront/[storeSlug]/products/[productSlug]/reviews/eligibility/route.js";
import {
  PATCH as patchStorefrontReview,
  DELETE as deleteStorefrontReview,
} from "../apps/web/app/api/v1/storefront/[storeSlug]/products/[productSlug]/reviews/[reviewId]/route.js";
import {
  POST as reportStorefrontReview,
} from "../apps/web/app/api/v1/storefront/[storeSlug]/products/[productSlug]/reviews/[reviewId]/report/route.js";
import {
  GET as getMerchantReviews,
} from "../apps/web/app/api/v1/stores/[storeId]/reviews/route.js";
import {
  GET as getMerchantReviewDetails,
} from "../apps/web/app/api/v1/stores/[storeId]/reviews/[reviewId]/route.js";
import {
  PATCH as patchMerchantReviewStatus,
} from "../apps/web/app/api/v1/stores/[storeId]/reviews/[reviewId]/status/route.js";
import {
  POST as postMerchantReply,
  DELETE as deleteMerchantReply,
} from "../apps/web/app/api/v1/stores/[storeId]/reviews/[reviewId]/reply/route.js";

declare global {
  var __calcart_web_db: unknown;
}

describe("Product Reviews API Endpoints", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();
  const productService = new ProductService();
  const customerService = new CustomerService();

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

  async function createTestUser(email = "merchant@example.com") {
    const userId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Merchant User', 'scrypt:hash', 'ACTIVE')`,
      [userId, email],
    );
    return userId;
  }

  async function makeAuthHeaders(userId: string): Promise<Headers> {
    const sessionId = generateUuidV7();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.query(
      `INSERT INTO sessions (id, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [sessionId, userId, expiresAt],
    );
    const headers = new Headers();
    const cookie = serializeSessionCookie(sessionId, { expires: expiresAt });
    headers.set("cookie", cookie);
    headers.set("content-type", "application/json");
    return headers;
  }

  async function createStoreWithProduct(userId: string) {
    const store = await storeService.createStore(db, userId, {
      name: "Acme Reviews Store",
      slug: `acme-${Date.now()}`,
      currency: "USD",
      locale: "en-US",
      timezone: "America/New_York",
    });

    const product = await productService.createProduct(db, store.id, {
      title: "Linen Trench Coat",
      slug: "linen-trench-coat",
      variants: [{ title: "Default", price: 35000, inventoryQuantity: 20 }],
    });

    return { store, product };
  }

  async function createCustomerOrder(storeId: string, productId: string, variantId: string, email = "customer@example.com") {
    const customerUserId = await createTestUser(email);
    const customer = await customerService.createCustomer(db, storeId, {
      email,
      firstName: "Alice",
      lastName: "Walker",
      userId: customerUserId,
    });

    const orderId = generateUuidV7();
    await db.query(
      `INSERT INTO orders (id, store_id, customer_id, order_number, status, payment_status, currency, total)
       VALUES ($1, $2, $3, $4, 'CONFIRMED', 'PAID', 'USD', 35000)`,
      [orderId, storeId, customer.id, `ORD-${Date.now()}`],
    );

    await db.query(
      `INSERT INTO order_items (id, order_id, store_id, product_id, variant_id, product_name_snapshot, variant_name_snapshot, quantity, unit_price, line_total)
       VALUES ($1, $2, $3, $4, $5, 'Linen Trench Coat', 'Default', 1, 35000, 35000)`,
      [generateUuidV7(), orderId, storeId, productId, variantId],
    );

    return { customer, customerUserId };
  }

  it("handles storefront submission, eligibility checks, and merchant moderation workflow", async () => {
    const merchantId = await createTestUser("owner@example.com");
    const { store, product } = await createStoreWithProduct(merchantId);
    const variantId = product.variants[0]!.id;

    const { customerUserId } = await createCustomerOrder(
      store.id,
      product.id,
      variantId,
      "buyer@example.com",
    );

    const customerHeaders = await makeAuthHeaders(customerUserId);
    const merchantHeaders = await makeAuthHeaders(merchantId);

    // 1. Check eligibility: customer is eligible
    const eligReq = new Request(
      `http://localhost/api/v1/storefront/${store.slug}/products/${product.slug}/reviews/eligibility`,
      { headers: customerHeaders },
    );
    const eligRes = await getEligibility(eligReq, {
      params: Promise.resolve({ storeSlug: store.slug, productSlug: product.slug }),
    });
    expect(eligRes.status).toBe(200);
    const eligBody = await eligRes.json();
    expect(eligBody.data.canReview).toBe(true);
    expect(eligBody.data.isVerified).toBe(true);

    // 2. Submit review via storefront API
    const submitReq = new Request(
      `http://localhost/api/v1/storefront/${store.slug}/products/${product.slug}/reviews`,
      {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({
          rating: 5,
          title: "Incredible silhouette and construction",
          content: "The fabric weight is perfect for transitional seasons.",
        }),
      },
    );
    const submitRes = await postStorefrontReview(submitReq, {
      params: Promise.resolve({ storeSlug: store.slug, productSlug: product.slug }),
    });
    expect(submitRes.status).toBe(201);
    const submitBody = await submitRes.json();
    const reviewId = submitBody.data.id;
    expect(reviewId).toBeDefined();
    expect(submitBody.data.status).toBe("PENDING");

    // 3. Storefront GET excludes pending review
    const listReq = new Request(
      `http://localhost/api/v1/storefront/${store.slug}/products/${product.slug}/reviews`,
    );
    const listRes = await getStorefrontReviews(listReq, {
      params: Promise.resolve({ storeSlug: store.slug, productSlug: product.slug }),
    });
    const listBody = await listRes.json();
    expect(listBody.data.items).toHaveLength(0);
    expect(listBody.data.summary.totalReviews).toBe(0);

    // 4. Merchant lists review in PENDING queue
    const merchantListReq = new Request(
      `http://localhost/api/v1/stores/${store.id}/reviews?status=PENDING`,
      { headers: merchantHeaders },
    );
    const merchantListRes = await getMerchantReviews(merchantListReq, {
      params: Promise.resolve({ storeId: store.id }),
    });
    const merchantListBody = await merchantListRes.json();
    expect(merchantListBody.data.items).toHaveLength(1);
    expect(merchantListBody.data.stats.pending).toBe(1);

    // 5. Merchant approves review -> PUBLISHED
    const modReq = new Request(
      `http://localhost/api/v1/stores/${store.id}/reviews/${reviewId}/status`,
      {
        method: "PATCH",
        headers: merchantHeaders,
        body: JSON.stringify({ status: "PUBLISHED" }),
      },
    );
    const modRes = await patchMerchantReviewStatus(modReq, {
      params: Promise.resolve({ storeId: store.id, reviewId }),
    });
    expect(modRes.status).toBe(200);

    // 6. Merchant posts reply
    const replyReq = new Request(
      `http://localhost/api/v1/stores/${store.id}/reviews/${reviewId}/reply`,
      {
        method: "POST",
        headers: merchantHeaders,
        body: JSON.stringify({ replyText: "Thank you for supporting our studio collection!" }),
      },
    );
    const replyRes = await postMerchantReply(replyReq, {
      params: Promise.resolve({ storeId: store.id, reviewId }),
    });
    expect(replyRes.status).toBe(200);

    // 6b. Merchant gets review details
    const detailReq = new Request(
      `http://localhost/api/v1/stores/${store.id}/reviews/${reviewId}`,
      { headers: merchantHeaders },
    );
    const detailRes = await getMerchantReviewDetails(detailReq, {
      params: Promise.resolve({ storeId: store.id, reviewId }),
    });
    expect(detailRes.status).toBe(200);
    const detailBody = await detailRes.json();
    expect(detailBody.data.id).toBe(reviewId);
    expect(detailBody.data.merchantReply).toBe(
      "Thank you for supporting our studio collection!",
    );

    // 6c. Merchant deletes reply and re-adds it
    const deleteReplyReq = new Request(
      `http://localhost/api/v1/stores/${store.id}/reviews/${reviewId}/reply`,
      { method: "DELETE", headers: merchantHeaders },
    );
    const deleteReplyRes = await deleteMerchantReply(deleteReplyReq, {
      params: Promise.resolve({ storeId: store.id, reviewId }),
    });
    expect(deleteReplyRes.status).toBe(200);

    // Re-add reply so step 7 passes
    await postMerchantReply(
      new Request(`http://localhost/api/v1/stores/${store.id}/reviews/${reviewId}/reply`, {
        method: "POST",
        headers: merchantHeaders,
        body: JSON.stringify({ replyText: "Thank you for supporting our studio collection!" }),
      }),
      {
        params: Promise.resolve({ storeId: store.id, reviewId }),
      },
    );

    // 7. Storefront GET now shows published review with reply and rating summary
    const pubListReq = new Request(
      `http://localhost/api/v1/storefront/${store.slug}/products/${product.slug}/reviews`,
    );
    const pubListRes = await getStorefrontReviews(pubListReq, {
      params: Promise.resolve({ storeSlug: store.slug, productSlug: product.slug }),
    });
    const pubListBody = await pubListRes.json();
    expect(pubListBody.data.items).toHaveLength(1);
    expect(pubListBody.data.items[0].merchantReply).toBe(
      "Thank you for supporting our studio collection!",
    );
    expect(pubListBody.data.summary.totalReviews).toBe(1);
    expect(pubListBody.data.summary.averageRating).toBe(5);

    // 8. Customer updates their review
    const editReq = new Request(
      `http://localhost/api/v1/storefront/${store.slug}/products/${product.slug}/reviews/${reviewId}`,
      {
        method: "PATCH",
        headers: customerHeaders,
        body: JSON.stringify({
          rating: 4,
          title: "Updated headline",
          content: "Updated review body content.",
        }),
      },
    );
    const editRes = await patchStorefrontReview(editReq, {
      params: Promise.resolve({
        storeSlug: store.slug,
        productSlug: product.slug,
        reviewId,
      }),
    });
    expect(editRes.status).toBe(200);
    const editBody = await editRes.json();
    expect(editBody.data.rating).toBe(4);
    expect(editBody.data.title).toBe("Updated headline");

    // 9. Report review
    const reportReq = new Request(
      `http://localhost/api/v1/storefront/${store.slug}/products/${product.slug}/reviews/${reviewId}/report`,
      {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({
          reason: "Misleading Information",
          details: "Not matching product description.",
        }),
      },
    );
    const reportRes = await reportStorefrontReview(reportReq, {
      params: Promise.resolve({
        storeSlug: store.slug,
        productSlug: product.slug,
        reviewId,
      }),
    });
    expect(reportRes.status).toBe(200);

    // 10. Customer deletes review
    const deleteReq = new Request(
      `http://localhost/api/v1/storefront/${store.slug}/products/${product.slug}/reviews/${reviewId}`,
      {
        method: "DELETE",
        headers: customerHeaders,
      },
    );
    const deleteRes = await deleteStorefrontReview(deleteReq, {
      params: Promise.resolve({
        storeSlug: store.slug,
        productSlug: product.slug,
        reviewId,
      }),
    });
    expect(deleteRes.status).toBe(200);
  });

  it("allows submitting reviews for two different products in the same order and rejects duplicate for same product", async () => {
    const merchantId = await createTestUser("merchant2@example.com");
    const { store } = await createStoreWithProduct(merchantId);

    const productA = await productService.createProduct(db, store.id, {
      title: "Product Alpha",
      slug: "product-alpha",
      variants: [{ title: "A", price: 10000, inventoryQuantity: 10 }],
    });
    const productB = await productService.createProduct(db, store.id, {
      title: "Product Beta",
      slug: "product-beta",
      variants: [{ title: "B", price: 15000, inventoryQuantity: 10 }],
    });

    const customerUserId = await createTestUser("buyer2@example.com");
    const customer = await customerService.createCustomer(db, store.id, {
      email: "buyer2@example.com",
      firstName: "Bob",
      lastName: "Brown",
      userId: customerUserId,
    });

    const orderId = generateUuidV7();
    await db.query(
      `INSERT INTO orders (id, store_id, customer_id, order_number, status, payment_status, currency, total)
       VALUES ($1, $2, $3, $4, 'CONFIRMED', 'PAID', 'USD', 25000)`,
      [orderId, store.id, customer.id, `ORD-MULTI-${Date.now()}`],
    );
    await db.query(
      `INSERT INTO order_items (id, order_id, store_id, product_id, variant_id, product_name_snapshot, variant_name_snapshot, quantity, unit_price, line_total)
       VALUES
         ($1, $2, $3, $4, $5, 'Product Alpha', 'A', 1, 10000, 10000),
         ($6, $2, $3, $7, $8, 'Product Beta', 'B', 1, 15000, 15000)`,
      [
        generateUuidV7(),
        orderId,
        store.id,
        productA.id,
        productA.variants[0]!.id,
        generateUuidV7(),
        productB.id,
        productB.variants[0]!.id,
      ],
    );

    const customerHeaders = await makeAuthHeaders(customerUserId);

    // 1. Submit review for Product A in order
    const reviewARes = await postStorefrontReview(
      new Request(`http://localhost/api/v1/storefront/${store.slug}/products/${productA.slug}/reviews`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({
          rating: 5,
          title: "Loved Product Alpha",
          content: "Top tier performance.",
          orderId,
        }),
      }),
      { params: Promise.resolve({ storeSlug: store.slug, productSlug: productA.slug }) },
    );
    expect(reviewARes.status).toBe(201);

    // 2. Submit review for Product B in the SAME order -> must succeed
    const reviewBRes = await postStorefrontReview(
      new Request(`http://localhost/api/v1/storefront/${store.slug}/products/${productB.slug}/reviews`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({
          rating: 4,
          title: "Loved Product Beta",
          content: "Solid addition.",
          orderId,
        }),
      }),
      { params: Promise.resolve({ storeSlug: store.slug, productSlug: productB.slug }) },
    );
    expect(reviewBRes.status).toBe(201);

    // 3. Attempt second review for Product A in the SAME order -> must fail with 409
    const dupRes = await postStorefrontReview(
      new Request(`http://localhost/api/v1/storefront/${store.slug}/products/${productA.slug}/reviews`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({
          rating: 3,
          title: "Duplicate attempt",
          content: "Trying again.",
          orderId,
        }),
      }),
      { params: Promise.resolve({ storeSlug: store.slug, productSlug: productA.slug }) },
    );
    expect(dupRes.status).toBe(409);
  });
});
