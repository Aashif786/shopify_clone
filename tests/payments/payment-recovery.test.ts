import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { PaymentRecoveryService } from "../../modules/payments/src/application/payment-recovery-service.js";
import { ProviderPaymentService } from "../../modules/payments/src/application/provider-payment-service.js";
import { RazorpayPaymentProvider } from "../../modules/payments/src/providers/razorpay-provider.js";
import { RazorpayClient } from "../../modules/payments/src/infrastructure/razorpay-client.js";
import { RazorpayTimeoutError } from "../../modules/payments/src/providers/razorpay-types.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("INT-04 & Payment Recovery Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function setupDb(): Promise<Database> {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    return isolated.database;
  }

  async function seedTestStore(
    db: Database,
    slug = "pmt-rcv-store",
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
    price = 7000,
  ): Promise<{ productId: string; variantId: string }> {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Wireless Headphones', $3, 'ACTIVE')`,
      [productId, storeId, `headphones-${Date.now().toString(36)}-${Math.random()}`],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Matte Black', 'HP-BLK-01', $4, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId, price],
    );

    return { productId, variantId };
  }

  async function seedCheckoutWithItem(
    db: Database,
    storeId: string,
    variantId: string,
    price = 7000,
  ): Promise<string> {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );

    const checkoutId = generateUuidV7();
    const address = JSON.stringify({
      firstName: "Alex",
      lastName: "Smith",
      addressLine1: "500 Howard St",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
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
       ) VALUES ($1, $2, $3, $4, 'Wireless Headphones', 'Matte Black', 'HP-BLK-01', $5, 1, $5)`,
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
    const amount = options?.amount ?? 7000;
    const paymentStatus = options?.paymentStatus ?? "CREATED";
    const attemptStatus = options?.attemptStatus ?? "INITIATED";

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

  describe("INT-04: Razorpay Order Creation Timeout and Duplicate Prevention", () => {
    it("handles order creation timeout by marking REQUIRES_RECONCILIATION and recovers without creating duplicate orders", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "timeout-recovery");
      const { variantId } = await seedProductAndVariant(db, storeId, 7000);
      const checkoutId = await seedCheckoutWithItem(db, storeId, variantId, 7000);
      const { paymentId, attemptId } = await seedPaymentAndAttempt(db, storeId, checkoutId);

      let orderCreationCalls = 0;
      let orderLookupCalls = 0;
      let simulateTimeoutOnFirstCall = true;

      // Mock transport that times out on first createOrder call, but records order created on provider
      const providerCreatedOrders = new Map<string, { id: string; amount: number; receipt: string }>();

      const mockTransport = async (input: string | URL | Request, init?: RequestInit) => {
        const urlStr = input.toString();

        if (urlStr.includes("/orders?") && init?.method === "GET") {
          orderLookupCalls++;
          const receiptMatch = urlStr.match(/receipt=([^&]+)/);
          const receipt = receiptMatch ? decodeURIComponent(receiptMatch[1] ?? "") : "";
          const found = providerCreatedOrders.get(receipt);
          return new Response(
            JSON.stringify({ items: found ? [found] : [] }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (urlStr.endsWith("/orders") && init?.method === "POST") {
          orderCreationCalls++;
          const body = JSON.parse(init?.body as string);
          // Provider creates order internally
          const orderObj = {
            id: `order_simulated_${Date.now()}`,
            amount: body.amount,
            currency: body.currency,
            status: "created",
            receipt: body.receipt,
          };
          providerCreatedOrders.set(body.receipt, orderObj);

          if (simulateTimeoutOnFirstCall) {
            simulateTimeoutOnFirstCall = false;
            throw new RazorpayTimeoutError("Network timeout waiting for Razorpay response");
          }

          return new Response(JSON.stringify(orderObj), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response("{}", { status: 404 });
      };

      const razorpayClient = new RazorpayClient({
        keyId: "rzp_test_key",
        keySecret: "rzp_test_secret",
        transport: mockTransport,
      });
      const provider = new RazorpayPaymentProvider({
        keyId: "rzp_test_key",
        keySecret: "rzp_test_secret",
        client: razorpayClient,
      });

      const service = new ProviderPaymentService(provider);

      // 1. Initial attempt times out
      await expect(
        service.createProviderOrder(db, storeId, paymentId, attemptId),
      ).rejects.toThrow(RazorpayTimeoutError);

      expect(orderCreationCalls).toBe(1);

      // Verify attempt is in REQUIRES_RECONCILIATION
      const attemptRes1 = await db.query<{ status: string; provider_order_id: string | null }>(
        `SELECT status, provider_order_id FROM payment_attempts WHERE id = $1`,
        [attemptId],
      );
      expect(attemptRes1.rows[0]?.status).toBe("REQUIRES_RECONCILIATION");
      expect(attemptRes1.rows[0]?.provider_order_id).toBeNull();

      // 2. Retry order creation: must NOT call createOrder again!
      // Must discover order created on provider via receipt and recover it
      const recovered = await service.createProviderOrder(db, storeId, paymentId, attemptId);

      expect(orderCreationCalls).toBe(1); // STILL 1! No blind duplicate order created!
      expect(orderLookupCalls).toBe(1); // Discovered via receipt lookup
      expect(recovered.providerOrderId).toContain("order_simulated_");

      // Verify database updated with recovered order ID and status PENDING
      const attemptRes2 = await db.query<{ status: string; provider_order_id: string | null }>(
        `SELECT status, provider_order_id FROM payment_attempts WHERE id = $1`,
        [attemptId],
      );
      expect(attemptRes2.rows[0]?.status).toBe("PENDING");
      expect(attemptRes2.rows[0]?.provider_order_id).toBe(recovered.providerOrderId);
    });
  });

  describe("Recovery of Orphaned Captured Payments", () => {
    it("recovers captured payment without order, creating order and completing checkout", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "orphan-recovery");
      const { variantId } = await seedProductAndVariant(db, storeId, 7000);
      const checkoutId = await seedCheckoutWithItem(db, storeId, variantId, 7000);

      // Payment is CAPTURED, but order_id is NULL (simulated worker crash before order creation)
      const { paymentId } = await seedPaymentAndAttempt(db, storeId, checkoutId, {
        amount: 7000,
        paymentStatus: "CAPTURED",
        attemptStatus: "CAPTURED",
      });

      const recoveryService = new PaymentRecoveryService();
      const result = await recoveryService.recoverOrphanedCapturedPayments(db);

      expect(result.recoveredCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.payments[0]?.status).toBe("SUCCESS");

      // Verify order now exists and is linked to payment
      const paymentRes = await db.query<{ order_id: string }>(
        `SELECT order_id FROM payments WHERE id = $1`,
        [paymentId],
      );
      expect(paymentRes.rows[0]?.order_id).not.toBeNull();

      // Verify checkout is now COMPLETED
      const checkoutRes = await db.query<{ status: string }>(
        `SELECT status FROM checkouts WHERE id = $1`,
        [checkoutId],
      );
      expect(checkoutRes.rows[0]?.status).toBe("COMPLETED");
    });
  });

  describe("Reconciliation of Ambiguous Payments", () => {
    it("queries provider for ambiguous payment and completes purchase when captured", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ambig-reconcile");
      const { variantId } = await seedProductAndVariant(db, storeId, 7000);
      const checkoutId = await seedCheckoutWithItem(db, storeId, variantId, 7000);

      const { paymentId } = await seedPaymentAndAttempt(db, storeId, checkoutId, {
        amount: 7000,
        paymentStatus: "REQUIRES_RECONCILIATION",
        attemptStatus: "REQUIRES_RECONCILIATION",
        providerPaymentId: "pay_ambiguous_123",
      });

      // Mock gateway returning captured status
      const mockTransport = async (input: string | URL | Request) => {
        const urlStr = input.toString();
        if (urlStr.includes("/payments/pay_ambiguous_123")) {
          return new Response(
            JSON.stringify({
              id: "pay_ambiguous_123",
              amount: 7000,
              currency: "USD",
              status: "captured",
              captured: true,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("{}", { status: 404 });
      };

      const razorpayClient = new RazorpayClient({
        keyId: "rzp_test_key",
        keySecret: "rzp_test_secret",
        transport: mockTransport,
      });
      const provider = new RazorpayPaymentProvider({
        keyId: "rzp_test_key",
        keySecret: "rzp_test_secret",
        client: razorpayClient,
      });

      const recoveryService = new PaymentRecoveryService(
        undefined,
        undefined,
        undefined,
        undefined,
        provider,
      );

      const result = await recoveryService.reconcileAmbiguousPayments(db);

      expect(result.reconciledCount).toBe(1);
      expect(result.payments[0]?.resolvedStatus).toBe("CAPTURED");

      // Verify payment is now CAPTURED and linked to order
      const paymentRes = await db.query<{ status: string; order_id: string | null }>(
        `SELECT status, order_id FROM payments WHERE id = $1`,
        [paymentId],
      );
      expect(paymentRes.rows[0]?.status).toBe("CAPTURED");
      expect(paymentRes.rows[0]?.order_id).not.toBeNull();
    });
  });
});
