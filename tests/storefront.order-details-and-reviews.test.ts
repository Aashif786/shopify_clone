import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { serializeSessionCookie, hashToken } from "@shopify-clone/auth";
import { StoreService } from "@shopify-clone/stores";
import { ProductService } from "@shopify-clone/products";
import { CustomerService } from "@shopify-clone/customers";
import { OrderService } from "@shopify-clone/orders";
import { createIsolatedDatabase } from "./helpers/postgres.js";
import { generateSecureToken } from "../apps/web/src/lib/storefront-auth-helpers.js";

import { GET as getStorefrontOrder } from "../apps/web/app/api/v1/storefront/[storeSlug]/orders/[orderId]/route.js";
import {
  GET as getReviews,
  POST as postReview,
} from "../apps/web/app/api/v1/storefront/[storeSlug]/products/[productSlug]/reviews/route.js";
import { GET as getEligibility } from "../apps/web/app/api/v1/storefront/[storeSlug]/products/[productSlug]/reviews/eligibility/route.js";
import {
  PATCH as patchReview,
  DELETE as deleteReview,
} from "../apps/web/app/api/v1/storefront/[storeSlug]/products/[productSlug]/reviews/[reviewId]/route.js";

declare global {
  var __shopify_clone_web_db: unknown;
}

describe("Storefront Customer Orders and Review Authentication Tests", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeService = new StoreService();
  const productService = new ProductService();
  const customerService = new CustomerService();
  const orderService = new OrderService();

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__shopify_clone_web_db = isolated.database;
  });

  afterEach(async () => {
    global.__shopify_clone_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function createTestUser(email: string, name = "Customer User") {
    const userId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, $3, 'scrypt:hash', 'ACTIVE')`,
      [userId, email, name],
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

  async function setupStoreWithCatalog() {
    const ownerUserId = await createTestUser("owner@example.com", "Merchant Owner");
    const store = await storeService.createStore(db, ownerUserId, {
      name: "Souled Store",
      slug: "souled-store",
      currency: "INR",
      locale: "en-IN",
      timezone: "Asia/Kolkata",
    });

    // Make sure store is ACTIVE
    await db.query(`UPDATE stores SET status = 'ACTIVE' WHERE id = $1`, [store.id]);

    const product = await productService.createProduct(db, store.id, {
      title: "Oversized Tee",
      slug: "oversized-tee",
      status: "ACTIVE",
      variants: [{ title: "M / Black", sku: "TEE-M-BLK", price: 99900, inventoryQuantity: 50 }],
    });

    return { store, product, ownerUserId };
  }

  describe("Issue 1: Customer Order Detail Resolution & Authorization", () => {
    it("allows the purchasing customer to view order details with full items, variants, totals, and addresses", async () => {
      const { store, product } = await setupStoreWithCatalog();
      const variant = product.variants[0]!;

      const customerUserId = await createTestUser("shopper@example.com", "Shopper User");
      const customer = await customerService.createCustomer(db, store.id, {
        email: "shopper@example.com",
        firstName: "Shopper",
        lastName: "User",
        userId: customerUserId,
      });

      const orderId = generateUuidV7();
      await db.query(
        `INSERT INTO orders (id, store_id, customer_id, order_number, status, payment_status, fulfillment_status, currency, subtotal, total, grand_total)
         VALUES ($1, $2, $3, $4, 'CONFIRMED', 'PAID', 'UNFULFILLED', 'INR', 99900, 99900, 99900)`,
        [orderId, store.id, customer.id, "ORD-TEST-1001"],
      );

      await db.query(
        `INSERT INTO order_items (id, order_id, store_id, product_id, variant_id, product_name_snapshot, variant_name_snapshot, sku_snapshot, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, 'Oversized Tee', 'M / Black', 'TEE-M-BLK', 1, 99900, 99900)`,
        [generateUuidV7(), orderId, store.id, product.id, variant.id],
      );

      await db.query(
        `INSERT INTO order_addresses (id, order_id, store_id, type, name, address_line_1, city, state, postal_code, country)
         VALUES ($1, $2, $3, 'SHIPPING', 'Shopper User', '123 Fashion Street', 'Mumbai', 'MH', '400001', 'IN')`,
        [generateUuidV7(), orderId, store.id],
      );

      const customerHeaders = await makeAuthHeaders(customerUserId);

      // Authorized customer request to order detail endpoint
      const req = new Request(
        `http://localhost/api/v1/storefront/${store.slug}/orders/${orderId}`,
        { headers: customerHeaders },
      );
      const res = await getStorefrontOrder(req, {
        params: Promise.resolve({ storeSlug: store.slug, orderId }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.order.id).toBe(orderId);
      expect(body.data.order.orderNumber).toBe("ORD-TEST-1001");
      expect(body.data.order.paymentStatus).toBe("PAID");
      expect(body.data.order.fulfillmentStatus).toBe("UNFULFILLED");
      expect(body.data.order.items).toHaveLength(1);
      expect(body.data.order.items[0].productNameSnapshot).toBe("Oversized Tee");
      expect(body.data.order.items[0].variantNameSnapshot).toBe("M / Black");
      expect(body.data.order.items[0].skuSnapshot).toBe("TEE-M-BLK");
      expect(body.data.order.items[0].unitPrice).toBe(99900);
      expect(body.data.order.addresses).toHaveLength(1);
      expect(body.data.order.addresses[0].city).toBe("Mumbai");
      expect(body.data.store.slug).toBe(store.slug);
    });

    it("returns 404 for unauthenticated requests or requests from other customers to prevent order enumeration", async () => {
      const { store, product } = await setupStoreWithCatalog();
      const variant = product.variants[0]!;

      const customer1UserId = await createTestUser("customer1@example.com", "Customer One");
      const customer1 = await customerService.createCustomer(db, store.id, {
        email: "customer1@example.com",
        firstName: "Customer",
        lastName: "One",
        userId: customer1UserId,
      });

      const customer2UserId = await createTestUser("customer2@example.com", "Customer Two");
      await customerService.createCustomer(db, store.id, {
        email: "customer2@example.com",
        firstName: "Customer",
        lastName: "Two",
        userId: customer2UserId,
      });

      const orderId = generateUuidV7();
      await db.query(
        `INSERT INTO orders (id, store_id, customer_id, order_number, status, payment_status, currency, total)
         VALUES ($1, $2, $3, 'ORD-CUST1', 'CONFIRMED', 'PAID', 'INR', 99900)`,
        [orderId, store.id, customer1.id],
      );

      // 1. Unauthenticated request -> 404
      const unauthReq = new Request(
        `http://localhost/api/v1/storefront/${store.slug}/orders/${orderId}`,
      );
      const unauthRes = await getStorefrontOrder(unauthReq, {
        params: Promise.resolve({ storeSlug: store.slug, orderId }),
      });
      expect(unauthRes.status).toBe(404);

      // 2. Customer 2 request -> 404
      const customer2Headers = await makeAuthHeaders(customer2UserId);
      const cust2Req = new Request(
        `http://localhost/api/v1/storefront/${store.slug}/orders/${orderId}`,
        { headers: customer2Headers },
      );
      const cust2Res = await getStorefrontOrder(cust2Req, {
        params: Promise.resolve({ storeSlug: store.slug, orderId }),
      });
      expect(cust2Res.status).toBe(404);
    });

    it("allows guest order access when providing valid guest ownership token and rejects forged tokens", async () => {
      const { store, product } = await setupStoreWithCatalog();
      const rawGuestToken = generateSecureToken();
      const guestTokenHash = hashToken(rawGuestToken);

      const orderId = generateUuidV7();
      await db.query(
        `INSERT INTO orders (id, store_id, customer_id, order_number, status, payment_status, currency, total, guest_token_hash)
         VALUES ($1, $2, NULL, 'ORD-GUEST-01', 'CONFIRMED', 'PAID', 'INR', 99900, $3)`,
        [orderId, store.id, guestTokenHash],
      );

      // 1. Guest request with valid token header -> 200
      const validHeaders = new Headers({ "x-guest-token": rawGuestToken });
      const validReq = new Request(
        `http://localhost/api/v1/storefront/${store.slug}/orders/${orderId}`,
        { headers: validHeaders },
      );
      const validRes = await getStorefrontOrder(validReq, {
        params: Promise.resolve({ storeSlug: store.slug, orderId }),
      });
      expect(validRes.status).toBe(200);

      // 2. Guest request with wrong token -> 404
      const invalidHeaders = new Headers({ "x-guest-token": "wrong-token-123" });
      const invalidReq = new Request(
        `http://localhost/api/v1/storefront/${store.slug}/orders/${orderId}`,
        { headers: invalidHeaders },
      );
      const invalidRes = await getStorefrontOrder(invalidReq, {
        params: Promise.resolve({ storeSlug: store.slug, orderId }),
      });
      expect(invalidRes.status).toBe(404);
    });
  });

  describe("Issue 2: Product Review Authentication & Eligibility States", () => {
    it("reports isAuthenticated=false and canReview=false when customer is not signed in", async () => {
      const { store, product } = await setupStoreWithCatalog();

      const req = new Request(
        `http://localhost/api/v1/storefront/${store.slug}/products/${product.slug}/reviews/eligibility`,
      );
      const res = await getEligibility(req, {
        params: Promise.resolve({ storeSlug: store.slug, productSlug: product.slug }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.canReview).toBe(false);
      expect(body.data.isVerified).toBe(false);
      expect(body.data.isAuthenticated).toBe(false);
      expect(body.data.message).toContain("sign in");
    });

    it("reports isAuthenticated=true and canReview=false with verified buyers message when customer is signed in but has not purchased product", async () => {
      const { store, product } = await setupStoreWithCatalog();
      const nonBuyerUserId = await createTestUser("visitor@example.com", "Visitor User");
      await customerService.createCustomer(db, store.id, {
        email: "visitor@example.com",
        firstName: "Visitor",
        lastName: "User",
        userId: nonBuyerUserId,
      });

      const headers = await makeAuthHeaders(nonBuyerUserId);
      const req = new Request(
        `http://localhost/api/v1/storefront/${store.slug}/products/${product.slug}/reviews/eligibility`,
        { headers },
      );
      const res = await getEligibility(req, {
        params: Promise.resolve({ storeSlug: store.slug, productSlug: product.slug }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.canReview).toBe(false);
      expect(body.data.isVerified).toBe(false);
      expect(body.data.isAuthenticated).toBe(true);
      expect(body.data.existingReview).toBeNull();
      expect(body.data.message).toContain("Only verified buyers");
    });

    it("reports isAuthenticated=true and canReview=true when signed in customer has purchased the product, allows review submission, editing, and deletion", async () => {
      const { store, product } = await setupStoreWithCatalog();
      const variant = product.variants[0]!;

      const buyerUserId = await createTestUser("verifiedbuyer@example.com", "Verified Buyer");
      const customer = await customerService.createCustomer(db, store.id, {
        email: "verifiedbuyer@example.com",
        firstName: "Verified",
        lastName: "Buyer",
        userId: buyerUserId,
      });

      const orderId = generateUuidV7();
      await db.query(
        `INSERT INTO orders (id, store_id, customer_id, order_number, status, payment_status, currency, total)
         VALUES ($1, $2, $3, 'ORD-VERIFIED-1', 'CONFIRMED', 'PAID', 'INR', 99900)`,
        [orderId, store.id, customer.id],
      );

      await db.query(
        `INSERT INTO order_items (id, order_id, store_id, product_id, variant_id, product_name_snapshot, variant_name_snapshot, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, 'Oversized Tee', 'M / Black', 1, 99900, 99900)`,
        [generateUuidV7(), orderId, store.id, product.id, variant.id],
      );

      const headers = await makeAuthHeaders(buyerUserId);

      // 1. Check eligibility: eligible to review!
      const eligReq = new Request(
        `http://localhost/api/v1/storefront/${store.slug}/products/${product.slug}/reviews/eligibility`,
        { headers },
      );
      const eligRes = await getEligibility(eligReq, {
        params: Promise.resolve({ storeSlug: store.slug, productSlug: product.slug }),
      });
      expect(eligRes.status).toBe(200);
      const eligBody = await eligRes.json();
      expect(eligBody.data.canReview).toBe(true);
      expect(eligBody.data.isVerified).toBe(true);
      expect(eligBody.data.isAuthenticated).toBe(true);
      expect(eligBody.data.eligibleOrderId).toBe(orderId);

      // 2. Submit a review
      const postReq = new Request(
        `http://localhost/api/v1/storefront/${store.slug}/products/${product.slug}/reviews`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            rating: 5,
            title: "Superb fabric quality and fit",
            content: "The oversized cut is comfortable and fits as expected.",
            orderId,
            variantId: variant.id,
          }),
        },
      );
      const postRes = await postReview(postReq, {
        params: Promise.resolve({ storeSlug: store.slug, productSlug: product.slug }),
      });
      expect(postRes.status).toBe(201);
      const postBody = await postRes.json();
      const reviewId = postBody.data.id;
      expect(reviewId).toBeDefined();

      // 3. After submitting, eligibility should reflect existingReview
      const recheckReq = new Request(
        `http://localhost/api/v1/storefront/${store.slug}/products/${product.slug}/reviews/eligibility`,
        { headers },
      );
      const recheckRes = await getEligibility(recheckReq, {
        params: Promise.resolve({ storeSlug: store.slug, productSlug: product.slug }),
      });
      expect(recheckRes.status).toBe(200);
      const recheckBody = await recheckRes.json();
      expect(recheckBody.data.canReview).toBe(false);
      expect(recheckBody.data.isAuthenticated).toBe(true);
      expect(recheckBody.data.existingReview).not.toBeNull();
      expect(recheckBody.data.existingReview.id).toBe(reviewId);

      // 4. Update the review
      const patchReq = new Request(
        `http://localhost/api/v1/storefront/${store.slug}/products/${product.slug}/reviews/${reviewId}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            rating: 4,
            title: "Updated: Still great after wash",
            content: "Slight shrinkage on first warm wash, otherwise very durable.",
          }),
        },
      );
      const patchRes = await patchReview(patchReq, {
        params: Promise.resolve({ storeSlug: store.slug, productSlug: product.slug, reviewId }),
      });
      expect(patchRes.status).toBe(200);
      const patchBody = await patchRes.json();
      expect(patchBody.data.rating).toBe(4);
      expect(patchBody.data.title).toBe("Updated: Still great after wash");

      // 5. Delete the review
      const delReq = new Request(
        `http://localhost/api/v1/storefront/${store.slug}/products/${product.slug}/reviews/${reviewId}`,
        {
          method: "DELETE",
          headers,
        },
      );
      const delRes = await deleteReview(delReq, {
        params: Promise.resolve({ storeSlug: store.slug, productSlug: product.slug, reviewId }),
      });
      expect(delRes.status).toBe(200);

      // 6. After deletion, customer should be eligible to write a review again
      const finalEligReq = new Request(
        `http://localhost/api/v1/storefront/${store.slug}/products/${product.slug}/reviews/eligibility`,
        { headers },
      );
      const finalEligRes = await getEligibility(finalEligReq, {
        params: Promise.resolve({ storeSlug: store.slug, productSlug: product.slug }),
      });
      const finalEligBody = await finalEligRes.json();
      expect(finalEligBody.data.canReview).toBe(true);
      expect(finalEligBody.data.existingReview).toBeNull();
    });
  });
});
