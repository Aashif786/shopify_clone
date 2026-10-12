import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { createHmac } from "node:crypto";
import {
  PaymentCheckoutCoordinator,
  PaymentOrderIntegration,
  ProviderPaymentService,
  RazorpayPaymentProvider,
  RazorpayClient,
  type HttpTransport,
} from "../../../modules/payments/src/index.js";
import { DiscountService, DiscountRedemptionService } from "@shopify-clone/discounts";
import { createIsolatedDatabase } from "../../helpers/postgres.js";

describe("Demo E2E Complete Purchase Workflow Integration", { timeout: 45_000 }, () => {
  let close: (() => Promise<void>) | undefined;

  const keyId = "rzp_test_demoKey123";
  const keySecret = "rzp_test_secretDemo456789";

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

  function createMockProvider(options?: {
    orderId?: string;
    gatewayAmount?: number;
    gatewayCurrency?: string;
  }): RazorpayPaymentProvider {
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
        return new Response(JSON.stringify(orderData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/payments/") && init?.method === "GET") {
        const pId = url.split("/payments/")[1] ?? "pay_prov_demo";
        return new Response(
          JSON.stringify({
            id: pId,
            entity: "payment",
            amount: options?.gatewayAmount ?? 8000,
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

  it("executes complete core purchase journey from catalog setup to order confirmation", async () => {
    const db = await setupDb();
    const discountService = new DiscountService();
    const redemptionService = new DiscountRedemptionService();

    // 1. Merchant Org & Store Setup
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, "Demo Merchant Org"],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, 'Demo Artisan Store', 'artisan-store', 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId],
    );

    // 2. Product & Inventory Setup
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const initialPrice = 10000; // $100.00
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Handcrafted Ceramic Teapot', 'ceramic-teapot', 'ACTIVE')`,
      [productId, storeId],
    );
    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Cobalt Blue', 'TP-BLU-01', $4, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId, initialPrice],
    );

    // Setup Inventory Item & Initial Stock
    const inventoryItemId = generateUuidV7();
    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, 25, 0)`,
      [inventoryItemId, storeId, variantId],
    );
    await db.query(
      `INSERT INTO inventory_adjustments (id, store_id, inventory_item_id, quantity_delta, previous_quantity, new_quantity, reason, reference_id)
       VALUES ($1, $2, $3, 25, 0, 25, 'INITIAL_STOCK', 'PO-1001')`,
      [generateUuidV7(), storeId, inventoryItemId],
    );

    // 3. Discount Creation & Activation (Merchant Admin UI Flow)
    const discount = await discountService.createDiscount(db, storeId, {
      code: "DEMO20",
      name: "Demo 20% Off Promotion",
      type: "PERCENTAGE",
      value: 20,
      currency: "USD",
      minimumSubtotal: 5000, // $50.00 minimum spend
      usageLimit: 10,
    });
    expect(discount.code).toBe("DEMO20");
    expect(discount.status).toBe("ACTIVE");
    expect(discount.usageCount).toBe(0);

    // 4. Customer Storefront Cart & Discount Application
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );
    const cartItemId = generateUuidV7();
    await db.query(
      `INSERT INTO cart_items (id, cart_id, store_id, variant_id, quantity, unit_price, line_subtotal)
       VALUES ($1, $2, $3, $4, 1, $5, $5)`,
      [cartItemId, cartId, storeId, variantId, initialPrice],
    );

    // Evaluate discount on cart subtotal ($100.00)
    const evaluated = await discountService.evaluateCode(db, storeId, "DEMO20", {
      subtotal: initialPrice,
      currency: "USD",
    });
    expect(evaluated.isValid).toBe(true);
    expect(evaluated.discount?.amount).toBe(2000); // 20% of 10000 = 2000 cents ($20.00)

    const finalSubtotal = initialPrice;
    const discountAmount = evaluated.discount!.amount;
    const finalTotal = finalSubtotal - discountAmount; // 8000 cents ($80.00)
    expect(finalTotal).toBe(8000);

    // 5. Checkout Creation & Reservation
    const checkoutId = generateUuidV7();
    const addressSnapshot = JSON.stringify({
      name: "Jane Doe",
      firstName: "Jane",
      lastName: "Doe",
      addressLine1: "123 Commerce St",
      city: "New York",
      province: "NY",
      postalCode: "10001",
      country: "US",
    });

    await db.query(
      `INSERT INTO checkouts (
         id, store_id, cart_id, subtotal, tax_total, shipping_total,
         discount_total, total, status, currency, email,
         shipping_address, billing_address
       ) VALUES ($1, $2, $3, $4, 0, 0, $5, $6, 'OPEN', 'USD', 'customer@example.com', $7, $7)`,
      [checkoutId, storeId, cartId, finalSubtotal, discountAmount, finalTotal, addressSnapshot],
    );

    await db.query(
      `INSERT INTO checkout_items (
         id, checkout_id, store_id, variant_id, product_name_snapshot,
         variant_name_snapshot, sku_snapshot, unit_price, quantity, line_total
       ) VALUES ($1, $2, $3, $4, 'Handcrafted Ceramic Teapot', 'Cobalt Blue', 'TP-BLU-01', $5, 1, $5)`,
      [generateUuidV7(), checkoutId, storeId, variantId, initialPrice],
    );

    // 6. Payment Initialization via PaymentCheckoutCoordinator
    const providerOrderId = "order_rzp_demo_98765";
    const provider = createMockProvider({
      orderId: providerOrderId,
      gatewayAmount: finalTotal,
      gatewayCurrency: "USD",
    });
    const providerService = new ProviderPaymentService(provider);
    const coordinator = new PaymentCheckoutCoordinator();

    const initResult = await coordinator.initializePaymentForCheckout(db, {
      storeId,
      checkoutId,
      idempotencyKey: "demo_init_key_001",
    });

    expect(initResult.payment.status).toBe("CREATED");
    expect(initResult.payment.amount).toBe(finalTotal);

    // Verify checkout transitioned to PAYMENT_PENDING
    const checkoutRow = await db.query<{ status: string }>(
      `SELECT status FROM checkouts WHERE id = $1`,
      [checkoutId],
    );
    expect(checkoutRow.rows[0]?.status).toBe("PAYMENT_PENDING");

    // 7. Create Razorpay Provider Order
    const rzpOrder = await providerService.createProviderOrder(
      db,
      storeId,
      initResult.payment.id,
      initResult.attempt.id,
    );
    expect(rzpOrder.providerOrderId).toBe(providerOrderId);

    // 8. Payment Callback & Order Finalization (Integration Pipeline)
    const providerPaymentId = "pay_rzp_captured_demo_01";
    const signature = computeValidCallbackSignature(providerOrderId, providerPaymentId, keySecret);

    const callbackResult = await providerService.verifyAndProcessCallback(db, {
      storeId,
      paymentId: initResult.payment.id,
      attemptId: initResult.attempt.id,
      razorpayOrderId: providerOrderId,
      razorpayPaymentId: providerPaymentId,
      razorpaySignature: signature,
    });

    expect(callbackResult.payment.status).toBe("CAPTURED");
    expect(callbackResult.attempt.status).toBe("CAPTURED");

    // Invoke purchase workflow to finalize order and complete checkout
    const orderIntegration = new PaymentOrderIntegration();
    const workflowResult = await orderIntegration.completePurchaseWorkflow(db, {
      storeId,
      paymentId: initResult.payment.id,
    });
    expect(workflowResult.order).toBeDefined();

    // 9. Verify Order State and Snapshot Immutability
    const orderRows = await db.query<{
      id: string;
      order_number: number;
      status: string;
      payment_status: string;
      total: number;
      subtotal: number;
      discount_total: number;
    }>(`SELECT * FROM orders WHERE checkout_id = $1`, [checkoutId]);
    expect(orderRows.rows.length).toBe(1);
    const order = orderRows.rows[0]!;
    expect(order.payment_status).toBe("PAID");
    expect(Number(order.total)).toBe(finalTotal);
    expect(Number(order.discount_total)).toBe(discountAmount);
    expect(Number(order.subtotal)).toBe(finalSubtotal);

    // Check payment linked to order
    const paymentRes = await db.query<{ order_id: string; status: string }>(
      `SELECT order_id, status FROM payments WHERE id = $1`,
      [initResult.payment.id],
    );
    expect(paymentRes.rows[0]?.order_id).toBe(order.id);
    expect(paymentRes.rows[0]?.status).toBe("CAPTURED");

    // Check checkout transitioned to COMPLETED
    const checkoutRes = await db.query<{ status: string; payment_status: string }>(
      `SELECT status, payment_status FROM checkouts WHERE id = $1`,
      [checkoutId],
    );
    expect(checkoutRes.rows[0]?.status).toBe("COMPLETED");

    // 10. Record Persistent Discount Redemption
    const redemption = await redemptionService.recordRedemption(db, {
      discountId: discount.id,
      storeId,
      orderId: order.id,
      checkoutId,
      amount: discountAmount,
      currency: "USD",
    });
    expect(redemption.id).toBeDefined();
    expect(redemption.orderId).toBe(order.id);

    // Verify discount usage count incremented
    const updatedDiscount = await discountService.getDiscountById(db, storeId, discount.id);
    expect(updatedDiscount?.usageCount).toBe(1);

    // 11. Verify Idempotent Duplicate Completion
    const duplicateResult = await orderIntegration.completePurchaseWorkflow(db, {
      storeId,
      paymentId: initResult.payment.id,
    });
    expect(duplicateResult.order.id).toBe(order.id);
    expect(duplicateResult.orderCreated).toBe(false);

    // Verify order count remains exactly 1
    const countRows = await db.query<{ count: string }>(
      `SELECT count(*)::text as count FROM orders WHERE checkout_id = $1`,
      [checkoutId],
    );
    expect(countRows.rows[0]?.count).toBe("1");
  });

  it("strictly prevents cross-store access during purchase journey", async () => {
    const db = await setupDb();
    const storeA = generateUuidV7();
    const storeB = generateUuidV7();
    const orgId = generateUuidV7();

    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, 'Org AB', 'ACTIVE')`, [orgId]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, 'Store A', 'store-a', 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeA, orgId],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, 'Store B', 'store-b', 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeB, orgId],
    );

    // Checkout created in Store A
    const checkoutId = generateUuidV7();
    const cartId = generateUuidV7();
    await db.query(`INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`, [cartId, storeA]);
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, subtotal, tax_total, shipping_total, discount_total, total, status, currency)
       VALUES ($1, $2, $3, 5000, 0, 0, 0, 5000, 'OPEN', 'USD')`,
      [checkoutId, storeA, cartId],
    );

    const coordinator = new PaymentCheckoutCoordinator();

    // Store B attempts to initialize payment for Store A's checkout
    await expect(
      coordinator.initializePaymentForCheckout(db, {
        storeId: storeB, // Mismatched store ID
        checkoutId,
        idempotencyKey: "cross_store_attempt_001",
      }),
    ).rejects.toThrow();
  });
});
