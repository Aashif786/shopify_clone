import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { createHmac } from "node:crypto";
import {
  PaymentCheckoutCoordinator,
  PaymentOrderIntegration,
  ProviderPaymentService,
  RazorpayPaymentProvider,
  RazorpayClient,
  PaymentWebhookService,
  PaymentValidationError,
  type HttpTransport,
} from "../../../modules/payments/src/index.js";
import {
  InventoryService,
  ReservationReleaseService,
} from "@calcart/inventory";
import { OrderService } from "@calcart/orders";
import { createIsolatedDatabase } from "../../helpers/postgres.js";

describe("Milestone C5: Payment & Checkout Failure-Path Integration Validation", { timeout: 45_000 }, () => {
  let close: (() => Promise<void>) | undefined;

  const keyId = "rzp_test_demoKeyC5";
  const keySecret = "rzp_test_secretDemoC5_123456789";
  const webhookSecret = "rzp_test_whsec_C5_demoSecret98765";

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

  function computeValidCallbackSignature(orderId: string, paymentId: string, secret = keySecret): string {
    return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  }

  function computeValidWebhookSignature(rawBody: string, secret = webhookSecret): string {
    return createHmac("sha256", secret).update(rawBody).digest("hex");
  }

  function createMockProvider(options?: {
    orderId?: string;
    gatewayAmount?: number;
    gatewayCurrency?: string;
    timeoutOnOrder?: boolean;
    failPaymentGet?: boolean;
  }): RazorpayPaymentProvider {
    const transport: HttpTransport = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/orders") && init?.method === "POST") {
        if (options?.timeoutOnOrder) {
          const abortErr = new Error("Gateway connection timed out");
          abortErr.name = "AbortError";
          throw abortErr;
        }
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const id = options?.orderId ?? `order_RZP_${Date.now().toString(36)}`;
        return new Response(
          JSON.stringify({
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
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("/payments/") && init?.method === "GET") {
        if (options?.failPaymentGet) {
          return new Response(JSON.stringify({ error: { code: "BAD_REQUEST_ERROR", description: "Payment not found" } }), { status: 400 });
        }
        const pId = url.split("/payments/")[1] ?? "pay_prov_demo";
        return new Response(
          JSON.stringify({
            id: pId,
            entity: "payment",
            amount: options?.gatewayAmount ?? 10000,
            currency: options?.gatewayCurrency ?? "USD",
            status: "captured",
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

    const client = new RazorpayClient({ keyId, keySecret, transport });
    return new RazorpayPaymentProvider({ keyId, keySecret, client });
  }

  async function seedStoreWithInventory(db: Database) {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, "Demo Org C5"],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, 'Demo C5 Store', 'demo-c5-store', 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId],
    );

    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Ceramic Teapot', 'ceramic-teapot', 'ACTIVE')`,
      [productId, storeId],
    );
    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Cobalt Blue', 'TP-BLU-01', 10000, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId],
    );

    const inventoryItemId = generateUuidV7();
    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, 20, 0)`,
      [inventoryItemId, storeId, variantId],
    );

    return { orgId, storeId, productId, variantId, inventoryItemId };
  }

  async function seedActiveCheckout(db: Database, storeId: string, variantId: string, total = 10000) {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );
    await db.query(
      `INSERT INTO cart_items (id, store_id, cart_id, variant_id, quantity, unit_price)
       VALUES ($1, $2, $3, $4, 1, $5)`,
      [generateUuidV7(), storeId, cartId, variantId, total],
    );

    const checkoutId = generateUuidV7();
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, total, subtotal, status, payment_status, currency, email)
       VALUES ($1, $2, $3, $4, $4, 'OPEN', 'PENDING', 'USD', 'customer@example.com')`,
      [checkoutId, storeId, cartId, total],
    );
    await db.query(
      `INSERT INTO checkout_items (id, store_id, checkout_id, variant_id, product_name_snapshot, variant_name_snapshot, sku_snapshot, quantity, unit_price, line_total)
       VALUES ($1, $2, $3, $4, 'Ceramic Teapot', 'Cobalt Blue', 'TP-BLU-01', 1, $5, $5)`,
      [generateUuidV7(), storeId, checkoutId, variantId, total],
    );

    return { cartId, checkoutId };
  }

  it("Case 1: verifies valid payment callback, captures payment, creates order, and finalizes checkout", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await seedStoreWithInventory(db);
    const { checkoutId } = await seedActiveCheckout(db, storeId, variantId, 10000);

    const providerOrderId = "order_RZP_VALID_C5";
    const provider = createMockProvider({ orderId: providerOrderId, gatewayAmount: 10000, gatewayCurrency: "USD" });
    const coordinator = new PaymentCheckoutCoordinator();
    const providerService = new ProviderPaymentService(provider);

    // 1. Initialize checkout payment
    const initResult = await coordinator.initializePaymentForCheckout(db, {
      storeId,
      checkoutId,
      provider: "razorpay",
      idempotencyKey: generateUuidV7(),
    });

    const createOrderResult = await providerService.createProviderOrder(
      db,
      storeId,
      initResult.payment.id,
      initResult.attempt.id,
    );

    expect(createOrderResult.providerOrderId).toBe(providerOrderId);

    // 2. Submit valid callback signature
    const razorpayPaymentId = "pay_prov_valid_123";
    const validSignature = computeValidCallbackSignature(providerOrderId, razorpayPaymentId);

    const callbackResult = await providerService.verifyAndProcessCallback(db, {
      storeId,
      paymentId: initResult.payment.id,
      attemptId: initResult.attempt.id,
      razorpayPaymentId,
      razorpayOrderId: providerOrderId,
      razorpaySignature: validSignature,
    });

    expect(callbackResult.payment.status).toBe("CAPTURED");
    expect(callbackResult.attempt.status).toBe("CAPTURED");

    // 3. Verify order was automatically finalized and linked
    const orderService = new OrderService();
    const order = await orderService.getOrderByCheckoutId(db, storeId, checkoutId);
    expect(order).not.toBeNull();
    expect(order?.paymentStatus).toBe("PAID");
    expect(order?.status).toBe("PENDING");

    // 4. Verify checkout is completed
    const chkRow = await db.query<{ status: string; payment_status: string }>(
      `SELECT status, payment_status FROM checkouts WHERE id = $1`,
      [checkoutId],
    );
    expect(chkRow.rows[0]?.status).toBe("COMPLETED");
  });

  it("Case 2: rejects invalid payment callback signature and prevents order creation", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await seedStoreWithInventory(db);
    const { checkoutId } = await seedActiveCheckout(db, storeId, variantId, 10000);

    const providerOrderId = "order_RZP_TAMPERED";
    const provider = createMockProvider({ orderId: providerOrderId, gatewayAmount: 10000 });
    const coordinator = new PaymentCheckoutCoordinator();
    const providerService = new ProviderPaymentService(provider);

    const initResult = await coordinator.initializePaymentForCheckout(db, {
      storeId,
      checkoutId,
      provider: "razorpay",
      idempotencyKey: generateUuidV7(),
    });

    await providerService.createProviderOrder(
      db,
      storeId,
      initResult.payment.id,
      initResult.attempt.id,
    );

    // Tampered signature
    const forgedSignature = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    await expect(
      providerService.verifyAndProcessCallback(db, {
        storeId,
        paymentId: initResult.payment.id,
        attemptId: initResult.attempt.id,
        razorpayPaymentId: "pay_prov_tampered",
        razorpayOrderId: providerOrderId,
        razorpaySignature: forgedSignature,
      }),
    ).rejects.toThrow(PaymentValidationError);

    // Assert payment did NOT transition to CAPTURED
    const pmt = await db.query<{ status: string }>(
      `SELECT status FROM payments WHERE id = $1`,
      [initResult.payment.id],
    );
    expect(pmt.rows[0]?.status).toBe("PENDING");

    // Assert NO order was created
    const orders = await db.query(
      `SELECT COUNT(*) as count FROM orders WHERE store_id = $1`,
      [storeId],
    );
    expect(Number(orders.rows[0]?.count)).toBe(0);

    // Assert checkout remains PAYMENT_PENDING and NOT completed
    const chk = await db.query<{ status: string }>(
      `SELECT status FROM checkouts WHERE id = $1`,
      [checkoutId],
    );
    expect(chk.rows[0]?.status).toBe("PAYMENT_PENDING");
  });

  it("Case 3: safely handles duplicate callback delivery idempotently without creating duplicate orders", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await seedStoreWithInventory(db);
    const { checkoutId } = await seedActiveCheckout(db, storeId, variantId, 10000);

    const providerOrderId = "order_RZP_DUP_CALLBACK";
    const provider = createMockProvider({ orderId: providerOrderId, gatewayAmount: 10000 });
    const coordinator = new PaymentCheckoutCoordinator();
    const providerService = new ProviderPaymentService(provider);
    const orderIntegration = new PaymentOrderIntegration();

    const initResult = await coordinator.initializePaymentForCheckout(db, {
      storeId,
      checkoutId,
      provider: "razorpay",
      idempotencyKey: generateUuidV7(),
    });

    await providerService.createProviderOrder(
      db,
      storeId,
      initResult.payment.id,
      initResult.attempt.id,
    );

    const razorpayPaymentId = "pay_prov_dup_123";
    const validSig = computeValidCallbackSignature(providerOrderId, razorpayPaymentId);

    // First callback
    const res1 = await providerService.verifyAndProcessCallback(db, {
      storeId,
      paymentId: initResult.payment.id,
      attemptId: initResult.attempt.id,
      razorpayPaymentId,
      razorpayOrderId: providerOrderId,
      razorpaySignature: validSig,
    });
    expect(res1.payment.status).toBe("CAPTURED");

    // Verify order was created on callback capture
    const orderRes1 = await orderIntegration.completePurchaseWorkflow(db, {
      storeId,
      checkoutId,
      paymentId: res1.payment.id,
    });
    expect(orderRes1.order.paymentStatus).toBe("PAID");

    // Duplicate callback
    const res2 = await providerService.verifyAndProcessCallback(db, {
      storeId,
      paymentId: initResult.payment.id,
      attemptId: initResult.attempt.id,
      razorpayPaymentId,
      razorpayOrderId: providerOrderId,
      razorpaySignature: validSig,
    });
    expect(res2.payment.status).toBe("CAPTURED");

    const orderRes2 = await orderIntegration.completePurchaseWorkflow(db, {
      storeId,
      checkoutId,
      paymentId: res2.payment.id,
    });
    expect(orderRes2.orderCreated).toBe(false);
    expect(orderRes2.order.id).toBe(orderRes1.order.id);

    // Verify database has exactly 1 order
    const totalOrders = await db.query(
      `SELECT COUNT(*) as count FROM orders WHERE store_id = $1`,
      [storeId],
    );
    expect(Number(totalOrders.rows[0]?.count)).toBe(1);
  });

  it("Case 4: deduplicates webhook delivery and responds safely without redundant mutations", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await seedStoreWithInventory(db);
    const { checkoutId } = await seedActiveCheckout(db, storeId, variantId, 10000);

    const coordinator = new PaymentCheckoutCoordinator();
    const localPayment = await coordinator.initializePaymentForCheckout(db, {
      storeId,
      checkoutId,
      provider: "razorpay",
      idempotencyKey: generateUuidV7(),
    });

    const providerOrderId = "order_wh_test";
    await db.query(
      `UPDATE payment_attempts SET provider_order_id = $1, status = 'PENDING' WHERE id = $2`,
      [providerOrderId, localPayment.attempt.id],
    );

    const webhookService = new PaymentWebhookService(webhookSecret);

    const eventPayload = {
      entity: "event",
      account_id: "acc_demo_c5",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: "pay_wh_dup_test",
            entity: "payment",
            amount: 10000,
            currency: "USD",
            status: "captured",
            order_id: providerOrderId,
            method: "card",
            captured: true,
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const rawBody = JSON.stringify(eventPayload);
    const signature = computeValidWebhookSignature(rawBody, webhookSecret);
    const eventId = `evt_${generateUuidV7()}`;

    // Delivery 1
    const res1 = await webhookService.processWebhook(db, {
      rawBody,
      signature,
      headerEventId: eventId,
    });
    expect(res1.status === "PROCESSED" || res1.status === "IGNORED").toBe(true);

    // Delivery 2 (duplicate)
    const res2 = await webhookService.processWebhook(db, {
      rawBody,
      signature,
      headerEventId: eventId,
    });
    expect(res2.status).toBe("DUPLICATE");
    expect((res2 as unknown as { duplicate?: boolean }).duplicate).toBe(true);

    // Database should have exactly 1 webhook event record
    const whRows = await db.query(
      `SELECT COUNT(*) as count FROM payment_webhook_events WHERE provider_event_id = $1`,
      [eventId],
    );
    expect(Number(whRows.rows[0]?.count)).toBe(1);
  });

  it("Case 5 & 6: maintains order and inventory consistency after interrupted/failed payment", async () => {
    const db = await setupDb();
    const inventoryService = new InventoryService();
    const releaseService = new ReservationReleaseService();
    const { storeId, variantId } = await seedStoreWithInventory(db);
    const { checkoutId } = await seedActiveCheckout(db, storeId, variantId, 10000);

    // Initial inventory: 20 available, 0 reserved
    const initialItem = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(initialItem.availableQuantity).toBe(20);
    expect(initialItem.reservedQuantity).toBe(0);

    // 1. Reserve 2 units for checkout
    const reservation = await inventoryService.reserve(db, storeId, {
      variantId,
      quantity: 2,
      referenceType: "checkout",
      referenceId: checkoutId,
    });
    expect(reservation.status).toBe("ACTIVE");

    // Stock after reservation: 18 available, 2 reserved, total 20
    const reservedItem = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(reservedItem.availableQuantity).toBe(18);
    expect(reservedItem.reservedQuantity).toBe(2);

    // 2. Customer payment fails or modal is dismissed (simulate failed payment attempt)
    const coordinator = new PaymentCheckoutCoordinator();
    const payment = await coordinator.initializePaymentForCheckout(db, {
      storeId,
      checkoutId,
      provider: "razorpay",
      idempotencyKey: generateUuidV7(),
    });

    // Mark attempt failed
    await db.query(
      `UPDATE payment_attempts SET status = 'FAILED', failure_code = 'PAYMENT_CANCELLED' WHERE id = $1`,
      [payment.attempt.id],
    );

    // 3. System releases reservations for failed/interrupted checkout
    const releaseResult = await releaseService.releaseOrderReservations(db, {
      storeId,
      checkoutId,
    });
    expect(releaseResult.releasedCount).toBe(1);

    // 4. Verify inventory is fully restored
    const restoredItem = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(restoredItem.availableQuantity).toBe(20);
    expect(restoredItem.reservedQuantity).toBe(0);

    // 5. Verify NO phantom orders exist in the database
    const ordersCount = await db.query(
      `SELECT COUNT(*) as count FROM orders WHERE store_id = $1`,
      [storeId],
    );
    expect(Number(ordersCount.rows[0]?.count)).toBe(0);

    // 6. Checkout was NOT completed
    const checkout = await db.query<{ status: string }>(
      `SELECT status FROM checkouts WHERE id = $1`,
      [checkoutId],
    );
    expect(checkout.rows[0]?.status).toBe("PAYMENT_PENDING");
  });

  it("Case 7: preserves consistency and records ambiguous state when payment provider times out", async () => {
    const db = await setupDb();
    const { storeId, variantId } = await seedStoreWithInventory(db);
    const { checkoutId } = await seedActiveCheckout(db, storeId, variantId, 10000);

    // Mock provider that aborts with timeout
    const timeoutProvider = createMockProvider({ timeoutOnOrder: true });
    const coordinator = new PaymentCheckoutCoordinator();
    const providerService = new ProviderPaymentService(timeoutProvider);

    const initResult = await coordinator.initializePaymentForCheckout(db, {
      storeId,    
      checkoutId,
      provider: "razorpay",
      idempotencyKey: generateUuidV7(),
    });

    // Attempt provider order creation with timeout
    await expect(
      providerService.createProviderOrder(
        db,
        storeId,
        initResult.payment.id,
        initResult.attempt.id,
      ),
    ).rejects.toThrow();

    // Verify payment attempt was marked REQUIRES_RECONCILIATION
    const attempt = await db.query<{ status: string; failure_code: string }>(
      `SELECT status, failure_code FROM payment_attempts WHERE id = $1`,
      [initResult.attempt.id],
    );
    expect(attempt.rows[0]?.status).toBe("REQUIRES_RECONCILIATION");

    // Zero orders created
    const orders = await db.query(
      `SELECT COUNT(*) as count FROM orders WHERE store_id = $1`,
      [storeId],
    );
    expect(Number(orders.rows[0]?.count)).toBe(0);
  });
});
