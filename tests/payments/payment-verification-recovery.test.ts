import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { ProviderPaymentService } from "../../modules/payments/src/application/provider-payment-service.js";
import { RazorpayPaymentProvider } from "../../modules/payments/src/providers/razorpay-provider.js";
import { RazorpayClient } from "../../modules/payments/src/infrastructure/razorpay-client.js";
import { RazorpayTimeoutError } from "../../modules/payments/src/providers/razorpay-types.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

function createRazorpaySignature(orderId: string, paymentId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}
import { createRequestTiming } from "../../apps/web/src/lib/api/context.js";
import { apiSuccess, apiError } from "../../apps/web/src/lib/api/response.js";
import { getDb, closeDb } from "../../apps/web/src/lib/db.js";

describe("Payment Verification & Reliability Recovery Integration", { timeout: 45_000 }, () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    await closeDb();
  });

  async function setupDb(): Promise<Database> {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    return isolated.database;
  }

  async function seedTestStore(
    db: Database,
    slug = "pmt-recovery-spec",
  ): Promise<{ orgId: string; storeId: string }> {
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

  async function seedProductAndVariant(
    db: Database,
    storeId: string,
    price = 5000,
  ): Promise<{ productId: string; variantId: string }> {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Handcrafted Mug', $3, 'ACTIVE')`,
      [productId, storeId, `mug-${Date.now().toString(36)}-${Math.random()}`],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Ceramic White', 'MUG-WHT-01', $4, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId, price],
    );

    return { productId, variantId };
  }

  async function seedCheckoutWithItem(
    db: Database,
    storeId: string,
    variantId: string,
    price = 5000,
  ): Promise<string> {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );

    const checkoutId = generateUuidV7();
    const address = JSON.stringify({
      firstName: "Taylor",
      lastName: "Swift",
      addressLine1: "123 Music Row",
      city: "Nashville",
      state: "TN",
      postalCode: "37203",
      country: "US",
    });

    await db.query(
      `INSERT INTO checkouts (
         id, store_id, cart_id, total, subtotal, discount_total, tax_total, shipping_total,
         status, payment_status, currency, shipping_address, billing_address
       ) VALUES ($1, $2, $3, $4, $4, 0, 0, 0, 'PAYMENT_PENDING', 'PENDING', 'USD', $5, $5)`,
      [checkoutId, storeId, cartId, price, address],
    );

    await db.query(
      `INSERT INTO checkout_items (
         id, checkout_id, store_id, variant_id, product_name_snapshot,
         variant_name_snapshot, sku_snapshot, unit_price, quantity, line_total
       ) VALUES ($1, $2, $3, $4, 'Handcrafted Mug', 'Ceramic White', 'MUG-WHT-01', $5, 1, $5)`,
      [generateUuidV7(), checkoutId, storeId, variantId, price],
    );

    return checkoutId;
  }

  async function seedPaymentAndAttempt(
    db: Database,
    storeId: string,
    checkoutId: string,
    options?: {
      amount?: number;
      paymentStatus?: string;
      attemptStatus?: string;
      providerPaymentId?: string | null;
      providerOrderId?: string | null;
    },
  ): Promise<{ paymentId: string; attemptId: string }> {
    const paymentId = generateUuidV7();
    const attemptId = generateUuidV7();
    const amount = options?.amount ?? 5000;
    const paymentStatus = options?.paymentStatus ?? "CREATED";
    const attemptStatus = options?.attemptStatus ?? "PENDING";

    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, amount, currency, status,
         provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, $4, 'USD', $5, 'razorpay', 0, 0)`,
      [paymentId, storeId, checkoutId, amount, paymentStatus],
    );

    await db.query(
      `INSERT INTO payment_attempts (
         id, payment_id, store_id, attempt_number, provider, amount, currency,
         status, provider_payment_id, provider_order_id
       ) VALUES ($1, $2, $3, 1, 'razorpay', $4, 'USD', $5, $6, $7)`,
      [
        attemptId,
        paymentId,
        storeId,
        amount,
        attemptStatus,
        options?.providerPaymentId ?? null,
        options?.providerOrderId ?? null,
      ],
    );

    return { paymentId, attemptId };
  }

  describe("1. Verification Timeout & Ambiguous State Handling", () => {
    it("does not fail payment on gateway verification timeout; records REQUIRES_RECONCILIATION and recovers via reconciliation", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "verify-timeout");
      const { variantId } = await seedProductAndVariant(db, storeId, 5000);
      const checkoutId = await seedCheckoutWithItem(db, storeId, variantId, 5000);
      const { paymentId, attemptId } = await seedPaymentAndAttempt(db, storeId, checkoutId, {
        providerOrderId: "order_timeout_test_123",
      });

      const keySecret = "test_secret_for_recovery_12345";
      const signature = createRazorpaySignature("order_timeout_test_123", "pay_timeout_999", keySecret);

      let gatewayCallCount = 0;
      let shouldTimeout = true;

      const mockTransport = async (input: string | URL | Request) => {
        const urlStr = input.toString();
        if (urlStr.includes("/payments/pay_timeout_999")) {
          gatewayCallCount++;
          if (shouldTimeout) {
            throw new RazorpayTimeoutError("Connection to Razorpay timed out");
          }
          return new Response(
            JSON.stringify({
              id: "pay_timeout_999",
              entity: "payment",
              amount: 5000,
              currency: "USD",
              status: "captured",
              order_id: "order_timeout_test_123",
              method: "card",
              captured: true,
              created_at: Math.floor(Date.now() / 1000),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("{}", { status: 404 });
      };

      const razorpayClient = new RazorpayClient({
        keyId: "rzp_test_key",
        keySecret,
        transport: mockTransport,
      });
      const provider = new RazorpayPaymentProvider({
        keyId: "rzp_test_key",
        keySecret,
        client: razorpayClient,
      });
      const providerService = new ProviderPaymentService(provider);

      // 1. Initial verification callback experiences gateway timeout
      const verifyOutcome = await providerService.verifyAndProcessCallback(db, {
        storeId,
        checkoutId,
        paymentId,
        attemptId,
        razorpayPaymentId: "pay_timeout_999",
        razorpayOrderId: "order_timeout_test_123",
        razorpaySignature: signature,
      });

      // Verify that the outcome is flagged as requiring reconciliation without hard failure
      expect(verifyOutcome.requiresReconciliation).toBe(true);
      expect(verifyOutcome.payment.status).toBe("REQUIRES_RECONCILIATION");
      expect(verifyOutcome.attempt.status).toBe("REQUIRES_RECONCILIATION");

      // Verify DB persisted the paymentId and signature for later recovery
      const attemptRow = await db.query<{ provider_payment_id: string; provider_signature: string; status: string }>(
        `SELECT provider_payment_id, provider_signature, status FROM payment_attempts WHERE id = $1`,
        [attemptId],
      );
      expect(attemptRow.rows[0]?.provider_payment_id).toBe("pay_timeout_999");
      expect(attemptRow.rows[0]?.provider_signature).toBe(signature);
      expect(attemptRow.rows[0]?.status).toBe("REQUIRES_RECONCILIATION");

      // 2. Gateway recovers: background reconciliation runs
      shouldTimeout = false;
      const reconResult = await providerService.reconcilePaymentWithGateway(db, storeId, paymentId);

      expect(gatewayCallCount).toBeGreaterThanOrEqual(2);
      expect(reconResult.reconciled).toBe(true);
      expect(reconResult.payment.status).toBe("CAPTURED");
      expect(reconResult.attempt.status).toBe("CAPTURED");
      expect(reconResult.order).toBeDefined();

      // Verify order was created and checkout marked completed
      const checkoutRow = await db.query<{ status: string }>(
        `SELECT status FROM checkouts WHERE id = $1`,
        [checkoutId],
      );
      expect(checkoutRow.rows[0]?.status).toBe("COMPLETED");
    });
  });

  describe("2. Stale Gateway Order & Credential Invalidation Recovery", () => {
    it("handles stale/invalid gateway order IDs (400 from gateway) by creating a clean new attempt under active credentials", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "stale-order-recovery");
      const { variantId } = await seedProductAndVariant(db, storeId, 5000);
      const checkoutId = await seedCheckoutWithItem(db, storeId, variantId, 5000);

      // Seed payment with stale provider order ID from an old credential set
      const { paymentId, attemptId } = await seedPaymentAndAttempt(db, storeId, checkoutId, {
        providerOrderId: "order_stale_from_old_key",
        paymentStatus: "CREATED",
        attemptStatus: "PENDING",
      });

      let createOrderCalled = false;
      const mockTransport = async (input: string | URL | Request, init?: RequestInit) => {
        const urlStr = input.toString();

        // When querying the old order ID with new key, Razorpay returns 400 Bad Request
        if (urlStr.includes("/orders/order_stale_from_old_key")) {
          return new Response(
            JSON.stringify({
              error: {
                code: "BAD_REQUEST_ERROR",
                description: "The order_id provided does not belong to the merchant account associated with key_id",
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // When creating a new order with the new key, Razorpay succeeds
        if (urlStr.endsWith("/orders") && init?.method === "POST") {
          createOrderCalled = true;
          return new Response(
            JSON.stringify({
              id: "order_fresh_from_active_key",
              entity: "order",
              amount: 5000,
              amount_paid: 0,
              amount_due: 5000,
              currency: "USD",
              status: "created",
              attempts: 0,
              created_at: Math.floor(Date.now() / 1000),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response("{}", { status: 404 });
      };

      const razorpayClient = new RazorpayClient({
        keyId: "rzp_test_active_key",
        keySecret: "active_secret_12345",
        transport: mockTransport,
      });
      const provider = new RazorpayPaymentProvider({
        keyId: "rzp_test_active_key",
        keySecret: "active_secret_12345",
        client: razorpayClient,
      });
      const providerService = new ProviderPaymentService(provider);

      // Execute createProviderOrder: should detect stale order, invalidate attempt 1, and create fresh attempt
      const result = await providerService.createProviderOrder(db, storeId, paymentId, attemptId);

      expect(result.providerOrderId).toBe("order_fresh_from_active_key");
      expect(result.razorpayKeyId).toBe("rzp_test_active_key");
      expect(createOrderCalled).toBe(true);

      // Verify the old attempt is marked FAILED and a new attempt exists
      const oldAttempt = await db.query<{ status: string; failure_code: string }>(
        `SELECT status, failure_code FROM payment_attempts WHERE id = $1`,
        [attemptId],
      );
      expect(oldAttempt.rows[0]?.status).toBe("FAILED");
      expect(oldAttempt.rows[0]?.failure_code).toBe("INVALID_GATEWAY_ORDER");

      // Verify the new attempt is created and active
      const allAttempts = await db.query<{ id: string; provider_order_id: string; status: string; attempt_number: number }>(
        `SELECT id, provider_order_id, status, attempt_number FROM payment_attempts WHERE payment_id = $1 ORDER BY attempt_number ASC`,
        [paymentId],
      );
      expect(allAttempts.rows.length).toBe(2);
      expect(allAttempts.rows[1]?.provider_order_id).toBe("order_fresh_from_active_key");
      expect(allAttempts.rows[1]?.status).toBe("PENDING");
      expect(allAttempts.rows[1]?.attempt_number).toBe(2);
    });
  });

  describe("3. Performance & Request Timing Instrumentation", () => {
    it("creates request timing with stages and outputs valid Server-Timing and X-Response-Time headers", () => {
      const timing = createRequestTiming();
      timing.recordStage("db", 14.5);
      timing.recordStage("provider", 82.3);

      const successResponse = apiSuccess({ ok: true }, { requestId: "req_perf_123", timing });
      expect(successResponse.headers.get("x-request-id")).toBe("req_perf_123");
      expect(successResponse.headers.get("X-Response-Time")).toMatch(/^\d+(\.\d+)?ms$/);
      expect(successResponse.headers.get("Server-Timing")).toContain("db;dur=14.5");
      expect(successResponse.headers.get("Server-Timing")).toContain("provider;dur=82.3");
      expect(successResponse.headers.get("Server-Timing")).toContain("total;dur=");

      const errorResponse = apiError("ERR_TEST", "Test error", 400, { requestId: "req_err_456", timing });
      expect(errorResponse.headers.get("x-request-id")).toBe("req_err_456");
      expect(errorResponse.headers.get("X-Response-Time")).toMatch(/^\d+(\.\d+)?ms$/);
      expect(errorResponse.headers.get("Server-Timing")).toContain("db;dur=14.5");
    });

    it("verifies getDb re-uses cached database pool singleton across calls", () => {
      process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test_db";
      const db1 = getDb();
      const db2 = getDb();
      expect(db1).toBe(db2);
    });
  });
});
