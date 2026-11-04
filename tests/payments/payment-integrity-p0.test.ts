import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
  PaymentRepository,
  RefundRepository,
} from "@calcart/db";
import {
  OrderCancellationRefundService,
  PaymentWebhookProcessor,
  PaymentWebhookService,
  ProviderPaymentService,
  PURCHASE_WORKFLOW_BLOCKED_PREFIX,
  RazorpayClient,
  RazorpayPaymentProvider,
  RefundService,
  type HttpTransport,
} from "../../modules/payments/src/index.js";
import { computeRazorpayWebhookSignature } from "../../modules/payments/src/webhooks/razorpay-webhook-signature.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import { confirmingRefundProvider } from "../helpers/refund-provider.js";

describe("P0 payment integrity", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const webhookSecret = "p0_webhook_secret_value";

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

  async function seedStore(db: Database, slug: string): Promise<string> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${slug}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'INR', 'en-IN', 'Asia/Kolkata')`,
      [storeId, orgId, `Store ${slug}`, `${slug}-${generateUuidV7()}`],
    );
    return storeId;
  }

  async function seedCapturedOrder(
    db: Database,
    storeId: string,
    amount = 5000,
  ): Promise<{ orderId: string; paymentId: string }> {
    const customerId = generateUuidV7();
    const cartId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const orderId = generateUuidV7();
    const paymentId = generateUuidV7();
    const attemptId = generateUuidV7();

    await db.query(
      `INSERT INTO customers (id, store_id, email, first_name, last_name)
       VALUES ($1, $2, $3, 'Test', 'Customer')`,
      [customerId, storeId, `c-${customerId.slice(0, 8)}@example.com`],
    );
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, customer_id, status, currency, total)
       VALUES ($1, $2, $3, $4, 'COMPLETED', 'INR', $5)`,
      [checkoutId, storeId, cartId, customerId, amount],
    );
    await db.query(
      `INSERT INTO orders (
         id, store_id, customer_id, checkout_id, order_number, status, payment_status,
         fulfillment_status, currency, subtotal, discount_total, shipping_total,
         tax_total, grand_total
       ) VALUES ($1, $2, $3, $4, $5, 'CANCELLED', 'PAID', 'CANCELLED', 'INR', $6, 0, 0, 0, $6)`,
      [orderId, storeId, customerId, checkoutId, `ORD-${orderId.slice(0, 8)}`, amount],
    );
    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, order_id, amount, currency, status, provider,
         captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, $4, $5, 'INR', 'CAPTURED', 'razorpay', $5, 0)`,
      [paymentId, storeId, checkoutId, orderId, amount],
    );
    await db.query(
      `INSERT INTO payment_attempts (
         id, payment_id, store_id, attempt_number, provider, provider_payment_id,
         amount, currency, status
       ) VALUES ($1, $2, $3, 1, 'razorpay', $4, $5, 'INR', 'CAPTURED')`,
      [attemptId, paymentId, storeId, `pay_${paymentId}`, amount],
    );
    return { orderId, paymentId };
  }

  async function seedVariantCheckout(
    db: Database,
    storeId: string,
    options: { status: string; amount: number },
  ): Promise<{ checkoutId: string; paymentId: string; attemptId: string; providerPaymentId: string }> {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const cartId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const paymentId = generateUuidV7();
    const attemptId = generateUuidV7();
    const providerPaymentId = `pay_${paymentId}`;
    const sku = `SKU-${variantId}`;

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Wallet', $3, 'ACTIVE')`,
      [productId, storeId, `wallet-${productId}`],
    );
    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Brown', $4, $5, 'INR', 'ACTIVE')`,
      [variantId, productId, storeId, sku, options.amount],
    );
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );
    const address = JSON.stringify({
      firstName: "Ada",
      lastName: "Lovelace",
      addressLine1: "1 Market St",
      city: "Mumbai",
      state: "MH",
      postalCode: "400001",
      country: "IN",
    });
    await db.query(
      `INSERT INTO checkouts (
         id, store_id, cart_id, total, subtotal, discount_total, tax_total, shipping_total,
         status, payment_status, currency, shipping_address, billing_address
       ) VALUES ($1, $2, $3, $4, $4, 0, 0, 0, $5, 'PENDING', 'INR', $6, $6)`,
      [checkoutId, storeId, cartId, options.amount, options.status, address],
    );
    await db.query(
      `INSERT INTO checkout_items (
         id, checkout_id, store_id, variant_id, product_name_snapshot,
         variant_name_snapshot, sku_snapshot, unit_price, quantity, line_total
       ) VALUES ($1, $2, $3, $4, 'Wallet', 'Brown', $5, $6, 1, $6)`,
      [generateUuidV7(), checkoutId, storeId, variantId, sku, options.amount],
    );
    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, amount, currency, status, provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, $4, 'INR', 'PENDING', 'razorpay', 0, 0)`,
      [paymentId, storeId, checkoutId, options.amount],
    );
    await db.query(
      `INSERT INTO payment_attempts (
         id, payment_id, store_id, attempt_number, provider, provider_payment_id, provider_order_id,
         amount, currency, status
       ) VALUES ($1, $2, $3, 1, 'razorpay', $4, $5, $6, 'INR', 'PENDING')`,
      [attemptId, paymentId, storeId, providerPaymentId, `order_${paymentId.slice(0, 8)}`, options.amount],
    );
    return { checkoutId, paymentId, attemptId, providerPaymentId };
  }

  function capturedPayload(providerPaymentId: string, providerOrderId: string, amount: number) {
    return {
      id: `evt_${providerPaymentId}`,
      entity: "event",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: providerPaymentId,
            entity: "payment",
            amount,
            currency: "INR",
            status: "captured",
            order_id: providerOrderId,
            captured: true,
          },
        },
      },
      created_at: 1700000000,
    };
  }

  it("calls the refund provider when a captured order is cancelled", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db, "cancel-real");
    const { orderId, paymentId } = await seedCapturedOrder(db, storeId);
    const calls = { count: 0 };
    const service = new OrderCancellationRefundService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      confirmingRefundProvider(calls),
    );

    const result = await service.processCancellationRefund(db, { storeId, orderId });

    expect(calls.count).toBe(1);
    expect(result.status).toBe("SUCCEEDED");
    expect(result.providerRefundId?.startsWith("rfnd_test_")).toBe(true);
    const payment = await new PaymentRepository().findById(db, storeId, paymentId);
    expect(payment?.status).toBe("REFUNDED");
    expect(Number(payment?.refunded_amount)).toBe(5000);
  });

  it("does not synthesize a successful refund when the provider is missing", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db, "cancel-missing");
    const { orderId, paymentId } = await seedCapturedOrder(db, storeId);
    const service = new OrderCancellationRefundService();

    const result = await service.processCancellationRefund(db, { storeId, orderId });

    expect(result.status).toBe("PENDING");
    expect(result.providerRefundId).toBeUndefined();
    const refunds = await new RefundRepository().findByPaymentId(db, storeId, paymentId);
    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.status).toBe("PENDING");
    expect(refunds[0]?.provider_refund_id ?? "").not.toContain("sim_rfnd_");
    const payment = await new PaymentRepository().findById(db, storeId, paymentId);
    expect(payment?.status).toBe("CAPTURED");
    expect(Number(payment?.refunded_amount)).toBe(0);
  });

  it("does not mark a refund succeeded when the provider rejects it", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db, "cancel-fail");
    const { orderId, paymentId } = await seedCapturedOrder(db, storeId);
    const provider = confirmingRefundProvider();
    provider.createRefund = async () => ({
      providerRefundId: "rfnd_rejected",
      amount: 5000,
      currency: "INR",
      status: "failed",
    });
    const service = new OrderCancellationRefundService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      provider,
    );

    const result = await service.processCancellationRefund(db, { storeId, orderId });

    expect(result.status).toBe("FAILED");
    const payment = await new PaymentRepository().findById(db, storeId, paymentId);
    expect(payment?.status).toBe("CAPTURED");
    expect(Number(payment?.refunded_amount)).toBe(0);
  });

  it("increments refunded amount once when success is processed concurrently", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db, "refund-race");
    const { orderId, paymentId } = await seedCapturedOrder(db, storeId);
    const refunds = new RefundService();
    const pending = await refunds.requestRefund(db, {
      storeId,
      paymentId,
      orderId,
      amount: 5000,
      reason: "race",
      idempotencyKey: "race-full",
    });

    await Promise.all([
      refunds.recordRefundSuccess(db, storeId, pending.id, "rfnd_race"),
      refunds.recordRefundSuccess(db, storeId, pending.id, "rfnd_race"),
    ]);

    const payment = await new PaymentRepository().findById(db, storeId, paymentId);
    expect(Number(payment?.refunded_amount)).toBe(5000);
    expect(payment?.status).toBe("REFUNDED");
  });

  it("keeps a succeeded refund succeeded when refund.failed arrives later", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db, "refund-late-fail");
    const { orderId, paymentId } = await seedCapturedOrder(db, storeId);
    const refunds = new RefundService();
    const pending = await refunds.requestRefund(db, {
      storeId,
      paymentId,
      orderId,
      amount: 5000,
      reason: "late fail",
      idempotencyKey: "late-fail",
    });
    await refunds.recordRefundSuccess(db, storeId, pending.id, "rfnd_late");

    const processor = new PaymentWebhookProcessor();
    const outcome = await processor.process(
      db,
      {
        entity: "event",
        event: "refund.failed",
        contains: ["refund"],
        payload: {
          refund: {
            entity: {
              id: "rfnd_late",
              entity: "refund",
              amount: 5000,
              currency: "INR",
              payment_id: `pay_${paymentId}`,
              status: "failed",
              receipt: pending.id,
            },
          },
        },
        created_at: 1700000000,
      },
      "evt_late_fail",
    );

    expect(outcome.status).toBe("IGNORED");
    const row = await new RefundRepository().findById(db, storeId, pending.id);
    expect(row?.status).toBe("SUCCEEDED");
    const payment = await new PaymentRepository().findById(db, storeId, paymentId);
    expect(Number(payment?.refunded_amount)).toBe(5000);
  });

  it("keeps partial refund totals equal to the sum of succeeded refunds", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db, "partial");
    const { orderId, paymentId } = await seedCapturedOrder(db, storeId, 5000);
    const refunds = new RefundService();
    const first = await refunds.requestRefund(db, {
      storeId,
      paymentId,
      orderId,
      amount: 2000,
      reason: "partial-1",
      idempotencyKey: "partial-1",
    });
    const second = await refunds.requestRefund(db, {
      storeId,
      paymentId,
      orderId,
      amount: 1500,
      reason: "partial-2",
      idempotencyKey: "partial-2",
    });

    await Promise.all([
      refunds.recordRefundSuccess(db, storeId, first.id, "rfnd_p1"),
      refunds.recordRefundSuccess(db, storeId, second.id, "rfnd_p2"),
    ]);

    const payment = await new PaymentRepository().findById(db, storeId, paymentId);
    expect(Number(payment?.refunded_amount)).toBe(3500);
    expect(payment?.status).toBe("PARTIALLY_REFUNDED");
    const rows = await new RefundRepository().findByPaymentId(db, storeId, paymentId);
    const succeeded = rows.filter((row) => row.status === "SUCCEEDED");
    expect(succeeded).toHaveLength(2);
    expect(succeeded.reduce((sum, row) => sum + Number(row.amount), 0)).toBe(3500);
  });

  it("does not acknowledge a captured webhook when order creation cannot finish", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db, "blocked-order");
    const seeded = await seedVariantCheckout(db, storeId, { status: "CANCELLED", amount: 4200 });
    const payload = capturedPayload(
      seeded.providerPaymentId,
      `order_${seeded.paymentId.slice(0, 8)}`,
      4200,
    );
    const rawBody = JSON.stringify(payload);
    const service = new PaymentWebhookService(webhookSecret);

    const first = await service.processWebhook(db, {
      rawBody,
      signature: computeRazorpayWebhookSignature(rawBody, webhookSecret),
      headerEventId: "header-must-not-be-the-id",
    });
    const second = await service.processWebhook(db, {
      rawBody,
      signature: computeRazorpayWebhookSignature(rawBody, webhookSecret),
      headerEventId: "a-different-header",
    });

    expect(first.status).toBe("RECONCILIATION_REQUIRED");
    expect(first.message?.startsWith(PURCHASE_WORKFLOW_BLOCKED_PREFIX)).toBe(true);
    expect(second.duplicate).toBe(true);
    const payment = await new PaymentRepository().findById(db, storeId, seeded.paymentId);
    expect(payment?.status).toBe("CAPTURED");
    expect(payment?.order_id).toBeNull();
    expect(payment?.reconciliation_reason).toContain("terminal status");
    const events = await db.query<{ status: string }>(
      `SELECT status FROM payment_webhook_events WHERE provider_event_id = $1`,
      [payload.id],
    );
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0]?.status).toBe("FAILED");
    const orders = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM orders WHERE store_id = $1`,
      [storeId],
    );
    expect(Number(orders.rows[0]?.count)).toBe(0);
  });

  it("does not create a second order when a captured webhook is retried", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db, "retry-order");
    const seeded = await seedVariantCheckout(db, storeId, { status: "PAYMENT_PENDING", amount: 6100 });
    const payload = capturedPayload(
      seeded.providerPaymentId,
      `order_${seeded.paymentId.slice(0, 8)}`,
      6100,
    );
    const rawBody = JSON.stringify(payload);
    const service = new PaymentWebhookService(webhookSecret);
    const input = {
      rawBody,
      signature: computeRazorpayWebhookSignature(rawBody, webhookSecret),
    };

    const first = await service.processWebhook(db, input);
    const second = await service.processWebhook(db, input);

    expect(first.status).toBe("PROCESSED");
    expect(second.status).toBe("DUPLICATE");
    const orders = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM orders WHERE store_id = $1 AND checkout_id = $2`,
      [storeId, seeded.checkoutId],
    );
    expect(Number(orders.rows[0]?.count)).toBe(1);
  });

  it("records the same reconciliation marker from verification and from the webhook", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db, "verify-webhook");
    const verified = await seedVariantCheckout(db, storeId, { status: "CANCELLED", amount: 5000 });
    const keySecret = "rzp_test_secret_value";
    const transport: HttpTransport = async (input) => {
      const url = String(input);
      const paymentId = url.split("/payments/")[1]?.split("?")[0] ?? verified.providerPaymentId;
      return new Response(
        JSON.stringify({
          id: paymentId,
          entity: "payment",
          amount: 5000,
          currency: "INR",
          status: "captured",
          order_id: `order_${verified.paymentId.slice(0, 8)}`,
          captured: true,
          created_at: 1700000000,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    const provider = new RazorpayPaymentProvider({
      keyId: "rzp_test_key",
      keySecret,
      client: new RazorpayClient({ keyId: "rzp_test_key", keySecret, transport }),
    });
    const signature = createHmac("sha256", keySecret)
      .update(`order_${verified.paymentId.slice(0, 8)}|${verified.providerPaymentId}`)
      .digest("hex");
    const verifiedResult = await new ProviderPaymentService(provider).verifyAndProcessCallback(db, {
      storeId,
      paymentId: verified.paymentId,
      attemptId: verified.attemptId,
      razorpayOrderId: `order_${verified.paymentId.slice(0, 8)}`,
      razorpayPaymentId: verified.providerPaymentId,
      razorpaySignature: signature,
    });

    const hooked = await seedVariantCheckout(db, storeId, { status: "CANCELLED", amount: 5000 });
    const payload = capturedPayload(
      hooked.providerPaymentId,
      `order_${hooked.paymentId.slice(0, 8)}`,
      5000,
    );
    const rawBody = JSON.stringify(payload);
    const hookedResult = await new PaymentWebhookService(webhookSecret).processWebhook(db, {
      rawBody,
      signature: computeRazorpayWebhookSignature(rawBody, webhookSecret),
    });

    expect(verifiedResult.payment.status).toBe("CAPTURED");
    expect(hookedResult.status).toBe("RECONCILIATION_REQUIRED");
    const payments = new PaymentRepository();
    const verifiedPayment = await payments.findById(db, storeId, verified.paymentId);
    const hookedPayment = await payments.findById(db, storeId, hooked.paymentId);
    expect(verifiedPayment?.order_id ?? null).toBeNull();
    expect(hookedPayment?.order_id ?? null).toBeNull();
    expect(verifiedPayment?.reconciliation_reason).toContain("terminal status");
    expect(hookedPayment?.reconciliation_reason).toContain("terminal status");
    expect(verifiedPayment?.status).toBe("CAPTURED");
    expect(hookedPayment?.status).toBe("CAPTURED");
  });

  it("does not apply a refund webhook to another store's payment", async () => {
    const db = await setupDb();
    const storeA = await seedStore(db, "tenant-a");
    const storeB = await seedStore(db, "tenant-b");
    const orderA = await seedCapturedOrder(db, storeA, 5000);
    const orderB = await seedCapturedOrder(db, storeB, 5000);
    const refunds = new RefundService();
    const refundA = await refunds.requestRefund(db, {
      storeId: storeA,
      paymentId: orderA.paymentId,
      orderId: orderA.orderId,
      amount: 5000,
      reason: "tenant",
      idempotencyKey: "tenant-a",
    });

    const processor = new PaymentWebhookProcessor();
    await expect(
      processor.process(
        db,
        {
          entity: "event",
          event: "refund.processed",
          contains: ["refund"],
          payload: {
            refund: {
              entity: {
                id: "rfnd_cross_store",
                entity: "refund",
                amount: 5000,
                currency: "INR",
                payment_id: `pay_${orderB.paymentId}`,
                status: "processed",
                receipt: refundA.id,
              },
            },
          },
          created_at: 1700000000,
        },
        "evt_cross_store",
      ),
    ).rejects.toThrow(/No local refund record/);

    const paymentA = await new PaymentRepository().findById(db, storeA, orderA.paymentId);
    const paymentB = await new PaymentRepository().findById(db, storeB, orderB.paymentId);
    expect(Number(paymentA?.refunded_amount)).toBe(0);
    expect(Number(paymentB?.refunded_amount)).toBe(0);
    const refundRow = await new RefundRepository().findById(db, storeA, refundA.id);
    expect(refundRow?.status).toBe("PENDING");
  });
});
