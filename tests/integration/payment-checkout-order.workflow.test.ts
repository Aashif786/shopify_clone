import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { createHmac } from "node:crypto";
import {
  PaymentCheckoutCoordinator,
  PaymentOrderIntegration,
  PaymentRecoveryService,
  PaymentWebhookService,
  ProviderPaymentService,
  RazorpayPaymentProvider,
  RazorpayClient,
  type HttpTransport,
  CrossStorePaymentAccessError,
  computeRazorpayWebhookSignature,
} from "../../modules/payments/src/index.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Payment-Checkout-Order End-to-End Workflow Integration", { timeout: 35_000 }, () => {
  let close: (() => Promise<void>) | undefined;

  const keyId = "rzp_test_flowKey123";
  const keySecret = "rzp_test_secretFlow456789";
  const webhookSecret = "whsec_flow_secret_test_001";

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
    slug = "flow-store",
    currency = "USD",
  ): Promise<{ orgId: string; storeId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${slug}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5, 'en-US', 'America/New_York')`,
      [storeId, orgId, `Store ${slug}`, slug, currency],
    );
    return { orgId, storeId };
  }

  async function seedProductAndVariant(
    db: Database,
    storeId: string,
    price = 7500,
  ): Promise<{ productId: string; variantId: string }> {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Ceramic Mug', $3, 'ACTIVE')`,
      [productId, storeId, `mug-${Date.now().toString(36)}-${Math.random()}`],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Matte Black', 'MUG-BLK', $4, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId, price],
    );

    return { productId, variantId };
  }

  async function seedCheckoutWithItem(
    db: Database,
    storeId: string,
    variantId: string,
    options?: {
      quantity?: number;
      price?: number;
      status?: string;
      currency?: string;
    },
  ): Promise<{ cartId: string; checkoutId: string }> {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );

    const checkoutId = generateUuidV7();
    const quantity = options?.quantity ?? 1;
    const price = options?.price ?? 7500;
    const total = quantity * price;
    const status = options?.status ?? "OPEN";
    const currency = options?.currency ?? "USD";

    const address = JSON.stringify({
      firstName: "Alice",
      lastName: "Smith",
      addressLine1: "456 Market St",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "US",
      phone: "+15559876543",
    });

    await db.query(
      `INSERT INTO checkouts (
         id, store_id, cart_id, total, subtotal, discount_total, tax_total, shipping_total,
         status, payment_status, currency, shipping_address, billing_address
       ) VALUES ($1, $2, $3, $4, $4, 0, 0, 0, $5, 'PENDING', $6, $7, $7)`,
      [checkoutId, storeId, cartId, total, status, currency, address],
    );

    await db.query(
      `INSERT INTO checkout_items (
         id, checkout_id, store_id, variant_id, product_name_snapshot,
         variant_name_snapshot, sku_snapshot, unit_price, quantity, line_total
       ) VALUES ($1, $2, $3, $4, 'Ceramic Mug', 'Matte Black', 'MUG-BLK', $5, $6, $7)`,
      [generateUuidV7(), checkoutId, storeId, variantId, price, quantity, total],
    );

    return { cartId, checkoutId };
  }

  function computeValidCallbackSignature(orderId: string, paymentId: string, secret = keySecret): string {
    return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  }

  function createMockProvider(options?: {
    orderId?: string;
    gatewayAmount?: number;
    gatewayCurrency?: string;
    gatewayStatus?: string;
  }): RazorpayPaymentProvider {
    const ordersMap = new Map<string, Record<string, unknown>>();

    const transport: HttpTransport = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/orders") && init?.method === "POST") {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const id = options?.orderId ?? `order_RZP_${Date.now().toString(36)}`;
        const orderData = {
          id,
          entity: "order",
          amount: body.amount,
          amount_paid: 0,
          amount_due: body.amount,
          currency: body.currency,
          receipt: body.receipt,
          status: "created",
          attempts: 0,
          created_at: Math.floor(Date.now() / 1000),
        };
        ordersMap.set(id, orderData);
        if (body.receipt) {
          ordersMap.set(`receipt:${body.receipt}`, orderData);
        }
        return new Response(JSON.stringify(orderData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/payments/") && init?.method === "GET") {
        const pId = url.split("/payments/")[1] ?? "pay_prov_123";
        return new Response(
          JSON.stringify({
            id: pId,
            entity: "payment",
            amount: options?.gatewayAmount ?? 7500,
            currency: options?.gatewayCurrency ?? "USD",
            status: options?.gatewayStatus ?? "captured",
            order_id: options?.orderId ?? "order_prov_default",
            method: "card",
            captured: true,
            created_at: Math.floor(Date.now() / 1000),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({}), { status: 404 });
    };

    const client = new RazorpayClient({
      keyId,
      keySecret,
      transport,
    });
    return new RazorpayPaymentProvider({ keyId, keySecret, client });
  }

  it("completes full purchase lifecycle: initialization -> provider order -> callback -> order created & checkout completed -> duplicate webhook handled", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "full-purchase-flow");
    const { variantId } = await seedProductAndVariant(db, storeId, 7500);
    const { checkoutId } = await seedCheckoutWithItem(db, storeId, variantId, {
      price: 7500,
      quantity: 1,
      status: "OPEN",
    });

    const coordinator = new PaymentCheckoutCoordinator();
    const orderIntegration = new PaymentOrderIntegration();
    const providerOrderId = "order_prov_flow_1";
    const provider = createMockProvider({ orderId: providerOrderId, gatewayAmount: 7500 });
    const providerService = new ProviderPaymentService(provider, undefined, undefined, orderIntegration);
    const webhookService = new PaymentWebhookService(webhookSecret, undefined, undefined, provider, orderIntegration);

    // 1. Initialize Payment for Checkout
    const initResult = await coordinator.initializePaymentForCheckout(db, {
      storeId,
      checkoutId,
      idempotencyKey: "flow-idemp-1",
    });

    expect(initResult.isExisting).toBe(false);
    expect(initResult.payment.status).toBe("CREATED");
    expect(initResult.payment.amount).toBe(7500);

    // Verify checkout transitioned to PAYMENT_PENDING
    const checkoutAfterInit = await db.query<{ status: string; payment_status: string }>(
      `SELECT status, payment_status FROM checkouts WHERE id = $1`,
      [checkoutId],
    );
    expect(checkoutAfterInit.rows[0]?.status).toBe("PAYMENT_PENDING");

    // 2. Create Razorpay Provider Order
    const rzpOrder = await providerService.createProviderOrder(
      db,
      storeId,
      initResult.payment.id,
      initResult.attempt.id,
    );
    expect(rzpOrder.providerOrderId).toBe(providerOrderId);

    // 3. Customer completes provider flow -> Callback arrives
    const providerPaymentId = "pay_rzp_callback_999";
    const callbackSignature = computeValidCallbackSignature(providerOrderId, providerPaymentId, keySecret);

    const callbackResult = await providerService.verifyAndProcessCallback(db, {
      storeId,
      paymentId: initResult.payment.id,
      attemptId: initResult.attempt.id,
      razorpayOrderId: providerOrderId,
      razorpayPaymentId: providerPaymentId,
      razorpaySignature: callbackSignature,
    });

    expect(callbackResult.payment.status).toBe("CAPTURED");
    expect(callbackResult.attempt.status).toBe("CAPTURED");

    // 4. Verify purchase completion effects
    // Check order created
    const ordersRes = await db.query<{
      id: string;
      order_number: string;
      status: string;
      payment_status: string;
      total: number;
    }>(
      `SELECT id, order_number, status, payment_status, total FROM orders WHERE checkout_id = $1`,
      [checkoutId],
    );
    expect(ordersRes.rows.length).toBe(1);
    const createdOrder = ordersRes.rows[0]!;
    expect(createdOrder.status).toBe("PENDING");
    expect(createdOrder.payment_status).toBe("PAID");
    expect(Number(createdOrder.total)).toBe(7500);

    // Check payment linked to order
    const paymentRes = await db.query<{ order_id: string; status: string }>(
      `SELECT order_id, status FROM payments WHERE id = $1`,
      [initResult.payment.id],
    );
    expect(paymentRes.rows[0]?.order_id).toBe(createdOrder.id);
    expect(paymentRes.rows[0]?.status).toBe("CAPTURED");

    // Check checkout transitioned to COMPLETED
    const checkoutRes = await db.query<{ status: string; payment_status: string }>(
      `SELECT status, payment_status FROM checkouts WHERE id = $1`,
      [checkoutId],
    );
    expect(checkoutRes.rows[0]?.status).toBe("COMPLETED");

    // 5. Subsequent webhook delivery for the exact same event
    const webhookPayload = {
      entity: "event",
      account_id: "acc_flow_test",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: providerPaymentId,
            entity: "payment",
            amount: 7500,
            currency: "USD",
            status: "captured",
            order_id: providerOrderId,
            captured: true,
            notes: {
              store_id: storeId,
              payment_id: initResult.payment.id,
              attempt_id: initResult.attempt.id,
            },
          },
        },
      },
    };
    const rawWebhookBody = JSON.stringify(webhookPayload);
    const webhookSig = computeRazorpayWebhookSignature(rawWebhookBody, webhookSecret);

    const webhookOutcome = await webhookService.processWebhook(db, {
      rawBody: rawWebhookBody,
      signature: webhookSig,
      headerEventId: "evt_subsequent_delivery_1",
    });

    expect(webhookOutcome.status).toBe("IGNORED");
    expect(webhookOutcome.message).toBe("Payment is already captured or refunded");

    // Invariant: Still exactly 1 order row in the database
    const ordersFinal = await db.query(`SELECT count(*)::int as count FROM orders WHERE checkout_id = $1`, [
      checkoutId,
    ]);
    expect(ordersFinal.rows[0]?.count).toBe(1);
  });

  it("recovers an interrupted workflow when payment was captured but order creation crashed", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "recover-captured-no-order");
    const { variantId } = await seedProductAndVariant(db, storeId, 5000);
    const { checkoutId } = await seedCheckoutWithItem(db, storeId, variantId, {
      price: 5000,
      quantity: 1,
      status: "PAYMENT_PENDING",
    });

    // Seed captured payment without order_id
    const paymentId = generateUuidV7();
    const attemptId = generateUuidV7();

    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, amount, currency, status,
         provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, 5000, 'USD', 'CAPTURED', 'razorpay', 5000, 0)`,
      [paymentId, storeId, checkoutId],
    );

    await db.query(
      `INSERT INTO payment_attempts (
         id, payment_id, store_id, attempt_number, provider, amount, currency,
         status, provider_payment_id, provider_order_id
       ) VALUES ($1, $2, $3, 1, 'razorpay', 5000, 'USD', 'CAPTURED', 'pay_rec_1', 'order_rec_1')`,
      [attemptId, paymentId, storeId],
    );

    // Verify 0 orders before recovery
    const beforeOrders = await db.query(`SELECT count(*)::int as count FROM orders WHERE checkout_id = $1`, [
      checkoutId,
    ]);
    expect(beforeOrders.rows[0]?.count).toBe(0);

    // Run recovery
    const recoveryService = new PaymentRecoveryService();
    const recResult = await recoveryService.recoverOrphanedCapturedPayments(db);

    expect(recResult.recoveredCount).toBe(1);
    expect(recResult.payments[0]?.paymentId).toBe(paymentId);
    expect(recResult.payments[0]?.status).toBe("SUCCESS");

    // Verify order created and checkout completed
    const ordersAfter = await db.query<{ id: string; status: string; payment_status: string }>(
      `SELECT id, status, payment_status FROM orders WHERE checkout_id = $1`,
      [checkoutId],
    );
    expect(ordersAfter.rows.length).toBe(1);
    expect(ordersAfter.rows[0]?.status).toBe("PENDING");
    expect(ordersAfter.rows[0]?.payment_status).toBe("PAID");

    const chkAfter = await db.query<{ status: string }>(`SELECT status FROM checkouts WHERE id = $1`, [
      checkoutId,
    ]);
    expect(chkAfter.rows[0]?.status).toBe("COMPLETED");

    const pmtAfter = await db.query<{ order_id: string }>(`SELECT order_id FROM payments WHERE id = $1`, [
      paymentId,
    ]);
    expect(pmtAfter.rows[0]?.order_id).toBe(ordersAfter.rows[0]?.id);
  });

  it("handles retry when order is already created but checkout completion previously failed", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "order-created-chk-failed");
    const { variantId } = await seedProductAndVariant(db, storeId, 6000);
    const { checkoutId } = await seedCheckoutWithItem(db, storeId, variantId, {
      price: 6000,
      quantity: 1,
      status: "PAYMENT_PENDING",
    });

    const paymentId = generateUuidV7();
    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, amount, currency, status,
         provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, 6000, 'USD', 'CAPTURED', 'razorpay', 6000, 0)`,
      [paymentId, storeId, checkoutId],
    );

    // Seed the order already created (e.g. from prior attempt)
    const orderId = generateUuidV7();
    await db.query(
      `INSERT INTO orders (
         id, store_id, checkout_id, order_number, status, payment_status,
         fulfillment_status, currency, subtotal, discount_total, shipping_total,
         tax_total, total
       ) VALUES ($1, $2, $3, 'ORD-PREV-001', 'PENDING', 'PAID', 'UNFULFILLED', 'USD', 6000, 0, 0, 0, 6000)`,
      [orderId, storeId, checkoutId],
    );

    const orderIntegration = new PaymentOrderIntegration();
    const result = await orderIntegration.completePurchaseWorkflow(db, {
      storeId,
      paymentId,
    });

    expect(result.order.id).toBe(orderId);
    expect(result.orderCreated).toBe(false);
    expect(result.checkout.status).toBe("COMPLETED");

    // Checkout completed
    const chk = await db.query<{ status: string }>(`SELECT status FROM checkouts WHERE id = $1`, [
      checkoutId,
    ]);
    expect(chk.rows[0]?.status).toBe("COMPLETED");

    // Payment linked
    const pmt = await db.query<{ order_id: string }>(`SELECT order_id FROM payments WHERE id = $1`, [
      paymentId,
    ]);
    expect(pmt.rows[0]?.order_id).toBe(orderId);

    // Invariant: Still exactly 1 order row in the database
    const ordersRes = await db.query(`SELECT count(*)::int as count FROM orders WHERE checkout_id = $1`, [
      checkoutId,
    ]);
    expect(ordersRes.rows[0]?.count).toBe(1);
  });

  it("handles concurrent callback and webhook race with exactly one order created", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "concurrent-race-store");
    const { variantId } = await seedProductAndVariant(db, storeId, 4500);
    const { checkoutId } = await seedCheckoutWithItem(db, storeId, variantId, {
      price: 4500,
      quantity: 1,
      status: "OPEN",
    });

    const coordinator = new PaymentCheckoutCoordinator();
    const orderIntegration = new PaymentOrderIntegration();
    const providerOrderId = "order_prov_race_1";
    const provider = createMockProvider({ orderId: providerOrderId, gatewayAmount: 4500 });
    const providerService = new ProviderPaymentService(provider, undefined, undefined, orderIntegration);
    const webhookService = new PaymentWebhookService(webhookSecret, undefined, undefined, provider, orderIntegration);

    // 1. Initialize Payment
    const initResult = await coordinator.initializePaymentForCheckout(db, {
      storeId,
      checkoutId,
      idempotencyKey: "race-init-1",
    });

    // 2. Create provider order
    await providerService.createProviderOrder(
      db,
      storeId,
      initResult.payment.id,
      initResult.attempt.id,
    );

    // 3. Race Callback and Webhook concurrently
    const providerPaymentId = "pay_rzp_race_999";
    const callbackSig = computeValidCallbackSignature(providerOrderId, providerPaymentId, keySecret);

    const webhookPayload = {
      entity: "event",
      account_id: "acc_race_test",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: providerPaymentId,
            entity: "payment",
            amount: 4500,
            currency: "USD",
            status: "captured",
            order_id: providerOrderId,
            captured: true,
            notes: {
              store_id: storeId,
              payment_id: initResult.payment.id,
              attempt_id: initResult.attempt.id,
            },
          },
        },
      },
    };
    const rawWebhookBody = JSON.stringify(webhookPayload);
    const webhookSig = computeRazorpayWebhookSignature(rawWebhookBody, webhookSecret);

    const [callbackRes, webhookRes] = await Promise.allSettled([
      providerService.verifyAndProcessCallback(db, {
        storeId,
        paymentId: initResult.payment.id,
        attemptId: initResult.attempt.id,
        razorpayOrderId: providerOrderId,
        razorpayPaymentId: providerPaymentId,
        razorpaySignature: callbackSig,
      }),
      webhookService.processWebhook(db, {
        rawBody: rawWebhookBody,
        signature: webhookSig,
        headerEventId: "evt_race_webhook_1",
      }),
    ]);

    // Both promises settle successfully
    expect(callbackRes.status).toBe("fulfilled");
    expect(webhookRes.status).toBe("fulfilled");

    // Invariant: Exactly one order row exists for checkout
    const orderRows = await db.query<{ id: string; status: string; payment_status: string }>(
      `SELECT id, status, payment_status FROM orders WHERE checkout_id = $1`,
      [checkoutId],
    );
    expect(orderRows.rows.length).toBe(1);
    expect(orderRows.rows[0]?.status).toBe("PENDING");
    expect(orderRows.rows[0]?.payment_status).toBe("PAID");

    // Checkout completed
    const chk = await db.query<{ status: string }>(`SELECT status FROM checkouts WHERE id = $1`, [
      checkoutId,
    ]);
    expect(chk.rows[0]?.status).toBe("COMPLETED");

    // Payment captured and linked
    const pmt = await db.query<{ status: string; order_id: string }>(
      `SELECT status, order_id FROM payments WHERE id = $1`,
      [initResult.payment.id],
    );
    expect(pmt.rows[0]?.status).toBe("CAPTURED");
    expect(pmt.rows[0]?.order_id).toBe(orderRows.rows[0]?.id);
  });

  it("strictly enforces store tenant boundary when completing purchase workflow", async () => {
    const db = await setupDb();
    const { storeId: storeA } = await seedTestStore(db, "store-tenant-a");
    const { storeId: storeB } = await seedTestStore(db, "store-tenant-b");
    const { variantId } = await seedProductAndVariant(db, storeA, 3000);
    const { checkoutId } = await seedCheckoutWithItem(db, storeA, variantId, {
      price: 3000,
      quantity: 1,
      status: "PAYMENT_PENDING",
    });

    const paymentId = generateUuidV7();
    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, amount, currency, status,
         provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, 3000, 'USD', 'CAPTURED', 'razorpay', 3000, 0)`,
      [paymentId, storeA, checkoutId],
    );

    const orderIntegration = new PaymentOrderIntegration();

    // Store B attempts to complete purchase for Store A's payment
    await expect(
      orderIntegration.completePurchaseWorkflow(db, {
        storeId: storeB,
        paymentId,
      }),
    ).rejects.toThrow(CrossStorePaymentAccessError);

    // No orders created in either store
    const ordersB = await db.query(`SELECT count(*)::int as count FROM orders WHERE store_id = $1`, [
      storeB,
    ]);
    expect(ordersB.rows[0]?.count).toBe(0);
  });
});
