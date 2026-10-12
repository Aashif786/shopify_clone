import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { createHmac } from "node:crypto";
import { POST as verifyPaymentRoute } from "../../apps/web/app/api/v1/storefront/[storeSlug]/checkout/[checkoutId]/payment/verify/route.js";
import { PaymentService } from "../../modules/payments/src/application/payment-service.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

declare global {
  var __shopify_clone_web_db: unknown;
}

describe("Storefront Payment Verification API Route (/payment/verify)", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const paymentService = new PaymentService();

  const testKeyId = "rzp_test_apiTestKey";
  const testKeySecret = "api_test_secret_key_123456789";
  const testProviderOrderId = "order_rzp_mock_test_12345";
  const testPaymentId = "pay_rzp_mock_captured_999";

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__shopify_clone_web_db = db;

    process.env.RAZORPAY_KEY_ID = testKeyId;
    process.env.RAZORPAY_KEY_SECRET = testKeySecret;
    // Set a different webhook secret to guarantee checkout never uses webhook secret
    process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_completely_different_secret_value";
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    global.__shopify_clone_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function seedTestStore(slug = "verify-test-store"): Promise<{ orgId: string; storeId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${slug}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, `Store ${slug}`, slug],
    );
    return { orgId, storeId };
  }

  async function seedTestCart(storeId: string): Promise<string> {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );
    return cartId;
  }

  async function seedTestCheckout(storeId: string, cartId: string, total = 5000): Promise<string> {
    const checkoutId = generateUuidV7();
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, $4, 'OPEN', 'PENDING', 'USD')`,
      [checkoutId, storeId, cartId, total],
    );
    return checkoutId;
  }

  function computeValidSignature(orderId: string, paymentId: string, secret = testKeySecret): string {
    return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  }

  function mockRazorpayFetch(options?: {
    captured?: boolean;
    orderId?: string;
    amount?: number;
    currency?: string;
  }) {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/payments/")) {
        return new Response(
          JSON.stringify({
            id: testPaymentId,
            entity: "payment",
            amount: options?.amount ?? 5000,
            currency: options?.currency ?? "USD",
            status: options?.captured === false ? "failed" : "captured",
            order_id: options?.orderId ?? testProviderOrderId,
            method: "card",
            captured: options?.captured !== false,
            created_at: 1700000000,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404 });
    });
  }

  it("verifies valid payment callback with camelCase payload fields", async () => {
    mockRazorpayFetch();
    const { storeId } = await seedTestStore("camelcase-verify-store");
    const cartId = await seedTestCart(storeId);
    const checkoutId = await seedTestCheckout(storeId, cartId, 5000);

    const localPayment = await paymentService.createPayment(db, {
      storeId,
      checkoutId,
      provider: "razorpay",
      idempotencyKey: generateUuidV7(),
    });

    // Set persisted provider_order_id on attempt and status to PENDING
    await db.query(
      `UPDATE payments SET status = 'PENDING' WHERE id = $1`,
      [localPayment.payment.id],
    );
    await db.query(
      `UPDATE payment_attempts SET provider_order_id = $1, status = 'PENDING' WHERE id = $2`,
      [testProviderOrderId, localPayment.attempt.id],
    );

    const validSig = computeValidSignature(testProviderOrderId, testPaymentId);

    const req = new Request(
      `http://localhost:3000/api/v1/storefront/camelcase-verify-store/checkout/${checkoutId}/payment/verify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: localPayment.payment.id,
          attemptId: localPayment.attempt.id,
          razorpayPaymentId: testPaymentId,
          razorpayOrderId: testProviderOrderId,
          razorpaySignature: validSig,
        }),
      },
    );

    const res = await verifyPaymentRoute(req, {
      params: Promise.resolve({ storeSlug: "camelcase-verify-store", checkoutId }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.verified).toBe(true);
    expect(body.data.paymentStatus).toBe("CAPTURED");
    expect(body.data.paymentId).toBe(localPayment.payment.id);
  });

  it("verifies valid payment callback with exact snake_case Razorpay callback fields", async () => {
    mockRazorpayFetch();
    const { storeId } = await seedTestStore("snakecase-verify-store");
    const cartId = await seedTestCart(storeId);
    const checkoutId = await seedTestCheckout(storeId, cartId, 5000);

    const localPayment = await paymentService.createPayment(db, {
      storeId,
      checkoutId,
      provider: "razorpay",
      idempotencyKey: generateUuidV7(),
    });

    await db.query(
      `UPDATE payments SET status = 'PENDING' WHERE id = $1`,
      [localPayment.payment.id],
    );
    await db.query(
      `UPDATE payment_attempts SET provider_order_id = $1, status = 'PENDING' WHERE id = $2`,
      [testProviderOrderId, localPayment.attempt.id],
    );

    const validSig = computeValidSignature(testProviderOrderId, testPaymentId);

    // Exact Razorpay handler fields (snake_case)
    const req = new Request(
      `http://localhost:3000/api/v1/storefront/snakecase-verify-store/checkout/${checkoutId}/payment/verify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: localPayment.payment.id,
          attemptId: localPayment.attempt.id,
          razorpay_payment_id: testPaymentId,
          razorpay_order_id: testProviderOrderId,
          razorpay_signature: validSig,
        }),
      },
    );

    const res = await verifyPaymentRoute(req, {
      params: Promise.resolve({ storeSlug: "snakecase-verify-store", checkoutId }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.verified).toBe(true);
    expect(body.data.paymentStatus).toBe("CAPTURED");
  });

  it("rejects callback with invalid/tampered HMAC signature", async () => {
    mockRazorpayFetch();
    const { storeId } = await seedTestStore("inv-sig-store");
    const cartId = await seedTestCart(storeId);
    const checkoutId = await seedTestCheckout(storeId, cartId, 5000);

    const localPayment = await paymentService.createPayment(db, {
      storeId,
      checkoutId,
      provider: "razorpay",
      idempotencyKey: generateUuidV7(),
    });

    await db.query(
      `UPDATE payment_attempts SET provider_order_id = $1, status = 'PENDING' WHERE id = $2`,
      [testProviderOrderId, localPayment.attempt.id],
    );

    const req = new Request(
      `http://localhost:3000/api/v1/storefront/inv-sig-store/checkout/${checkoutId}/payment/verify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: localPayment.payment.id,
          attemptId: localPayment.attempt.id,
          razorpayPaymentId: testPaymentId,
          razorpayOrderId: testProviderOrderId,
          razorpaySignature: "invalid_tampered_signature_hex_value_1234567890",
        }),
      },
    );

    const res = await verifyPaymentRoute(req, {
      params: Promise.resolve({ storeSlug: "inv-sig-store", checkoutId }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("Invalid Razorpay payment callback signature");
  });

  it("rejects callback signed with RAZORPAY_WEBHOOK_SECRET instead of RAZORPAY_KEY_SECRET", async () => {
    mockRazorpayFetch();
    const { storeId } = await seedTestStore("wh-secret-store");
    const cartId = await seedTestCart(storeId);
    const checkoutId = await seedTestCheckout(storeId, cartId, 5000);

    const localPayment = await paymentService.createPayment(db, {
      storeId,
      checkoutId,
      provider: "razorpay",
      idempotencyKey: generateUuidV7(),
    });

    await db.query(
      `UPDATE payment_attempts SET provider_order_id = $1, status = 'PENDING' WHERE id = $2`,
      [testProviderOrderId, localPayment.attempt.id],
    );

    // Compute signature using the webhook secret instead of the key secret
    const webhookSig = computeValidSignature(
      testProviderOrderId,
      testPaymentId,
      process.env.RAZORPAY_WEBHOOK_SECRET!,
    );

    const req = new Request(
      `http://localhost:3000/api/v1/storefront/wh-secret-store/checkout/${checkoutId}/payment/verify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: localPayment.payment.id,
          attemptId: localPayment.attempt.id,
          razorpayPaymentId: testPaymentId,
          razorpayOrderId: testProviderOrderId,
          razorpaySignature: webhookSig,
        }),
      },
    );

    const res = await verifyPaymentRoute(req, {
      params: Promise.resolve({ storeSlug: "wh-secret-store", checkoutId }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("Invalid Razorpay payment callback signature");
  });

  it("rejects callback when razorpayOrderId does not match attempt providerOrderId", async () => {
    mockRazorpayFetch();
    const { storeId } = await seedTestStore("ord-mismatch-store");
    const cartId = await seedTestCart(storeId);
    const checkoutId = await seedTestCheckout(storeId, cartId, 5000);

    const localPayment = await paymentService.createPayment(db, {
      storeId,
      checkoutId,
      provider: "razorpay",
      idempotencyKey: generateUuidV7(),
    });

    await db.query(
      `UPDATE payment_attempts SET provider_order_id = $1, status = 'PENDING' WHERE id = $2`,
      [testProviderOrderId, localPayment.attempt.id],
    );

    const mismatchedOrderId = "order_DIFFERENT_FORGED_999";
    const validSigForMismatched = computeValidSignature(mismatchedOrderId, testPaymentId);

    const req = new Request(
      `http://localhost:3000/api/v1/storefront/ord-mismatch-store/checkout/${checkoutId}/payment/verify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: localPayment.payment.id,
          attemptId: localPayment.attempt.id,
          razorpayPaymentId: testPaymentId,
          razorpayOrderId: mismatchedOrderId,
          razorpaySignature: validSigForMismatched,
        }),
      },
    );

    const res = await verifyPaymentRoute(req, {
      params: Promise.resolve({ storeSlug: "ord-mismatch-store", checkoutId }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("does not match attempt provider order ID");
  });

  it("rejects callback when internal checkoutId is substituted for razorpayOrderId", async () => {
    mockRazorpayFetch();
    const { storeId } = await seedTestStore("checkout-id-sub-store");
    const cartId = await seedTestCart(storeId);
    const checkoutId = await seedTestCheckout(storeId, cartId, 5000);

    const localPayment = await paymentService.createPayment(db, {
      storeId,
      checkoutId,
      provider: "razorpay",
      idempotencyKey: generateUuidV7(),
    });

    await db.query(
      `UPDATE payment_attempts SET provider_order_id = $1, status = 'PENDING' WHERE id = $2`,
      [testProviderOrderId, localPayment.attempt.id],
    );

    const sigWithCheckoutId = computeValidSignature(checkoutId, testPaymentId);

    const req = new Request(
      `http://localhost:3000/api/v1/storefront/checkout-id-sub-store/checkout/${checkoutId}/payment/verify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: localPayment.payment.id,
          attemptId: localPayment.attempt.id,
          razorpayPaymentId: testPaymentId,
          razorpayOrderId: checkoutId, // substituted internal checkout ID!
          razorpaySignature: sigWithCheckoutId,
        }),
      },
    );

    const res = await verifyPaymentRoute(req, {
      params: Promise.resolve({ storeSlug: "checkout-id-sub-store", checkoutId }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("does not match attempt provider order ID");
  });

  it("rejects callback with missing or empty required fields", async () => {
    const { storeId } = await seedTestStore("missing-fields-store");
    const cartId = await seedTestCart(storeId);
    const checkoutId = await seedTestCheckout(storeId, cartId, 5000);

    // Missing signature
    const req1 = new Request(
      `http://localhost:3000/api/v1/storefront/missing-fields-store/checkout/${checkoutId}/payment/verify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: generateUuidV7(),
          attemptId: generateUuidV7(),
          razorpayPaymentId: testPaymentId,
          razorpayOrderId: testProviderOrderId,
          razorpaySignature: "",
        }),
      },
    );
    const res1 = await verifyPaymentRoute(req1, {
      params: Promise.resolve({ storeSlug: "missing-fields-store", checkoutId }),
    });
    expect(res1.status).toBe(400);
    const body1 = await res1.json();
    expect(body1.error.message).toContain("razorpaySignature is required");

    // Missing order ID
    const req2 = new Request(
      `http://localhost:3000/api/v1/storefront/missing-fields-store/checkout/${checkoutId}/payment/verify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: generateUuidV7(),
          attemptId: generateUuidV7(),
          razorpayPaymentId: testPaymentId,
          razorpaySignature: "sig_123",
        }),
      },
    );
    const res2 = await verifyPaymentRoute(req2, {
      params: Promise.resolve({ storeSlug: "missing-fields-store", checkoutId }),
    });
    expect(res2.status).toBe(400);
    const body2 = await res2.json();
    expect(body2.error.message).toContain("razorpayOrderId is required");
  });
});
