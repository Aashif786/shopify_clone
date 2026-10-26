import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { createHmac, createHash } from "node:crypto";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import { ProductService } from "@shopify-clone/products";
import { InventoryService } from "@shopify-clone/inventory";
import { CustomerService } from "@shopify-clone/customers";
import { OrderService, OrderStatusService, OrderCancellationCoordinator } from "@shopify-clone/orders";
import {
  OrderCancellationRefundService,
  RefundService,
} from "@shopify-clone/payments";
import { POST as initiatePaymentRoute } from "../../apps/web/app/api/v1/storefront/[storeSlug]/checkout/[checkoutId]/payment/route.js";
import { POST as verifyPaymentRoute } from "../../apps/web/app/api/v1/storefront/[storeSlug]/checkout/[checkoutId]/payment/verify/route.js";
import { POST as cancelCheckoutRoute } from "../../apps/web/app/api/v1/stores/[storeId]/checkouts/[checkoutId]/cancel/route.js";
import { ReservationReleaseService } from "@shopify-clone/inventory";

declare global {
  var __shopify_clone_web_db: unknown;
}

describe("Storefront to Merchant Lifecycle End-to-End Integration", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;

  const testKeyId = "rzp_test_lifecycleKey";
  const testKeySecret = "lifecycle_secret_key_123456789";

  const productService = new ProductService();
  const inventoryService = new InventoryService();
  const customerService = new CustomerService();
  const orderService = new OrderService();
  const orderStatusService = new OrderStatusService();
  const refundService = new RefundService();
  const reservationReleaseService = new ReservationReleaseService();
  const cancellationRefundService = new OrderCancellationRefundService(refundService);
  const cancellationCoordinator = new OrderCancellationCoordinator(
    orderStatusService,
    undefined,
    reservationReleaseService,
    cancellationRefundService,
  );

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__shopify_clone_web_db = db;

    process.env.RAZORPAY_KEY_ID = testKeyId;
    process.env.RAZORPAY_KEY_SECRET = testKeySecret;
    process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_lifecycle_test_secret_999";
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    global.__shopify_clone_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  function computeValidCallbackSignature(orderId: string, paymentId: string, secret = testKeySecret): string {
    return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  }

  async function seedTestStore(slug = "lifecycle-store"): Promise<{
    orgId: string;
    storeId: string;
    merchantUserId: string;
    sessionId: string;
  }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    const merchantUserId = generateUuidV7();
    const sessionId = generateUuidV7();

    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`, [
      orgId,
      `Org ${slug}`,
    ]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, `Store ${slug}`, slug],
    );
    await db.query(
      `INSERT INTO users (id, email, password_hash, name, status)
       VALUES ($1, $2, 'hash_test', 'Merchant Admin', 'ACTIVE')`,
      [merchantUserId, `merchant_${slug}@example.com`],
    );
    await db.query(
      `INSERT INTO store_memberships (id, store_id, user_id, role, status)
       VALUES ($1, $2, $3, 'owner', 'ACTIVE')`,
      [generateUuidV7(), storeId, merchantUserId],
    );
    await db.query(
      `INSERT INTO sessions (id, user_id, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 day')`,
      [sessionId, merchantUserId],
    );

    return { orgId, storeId, merchantUserId, sessionId };
  }

  async function seedTestCheckout(
    storeId: string,
    variant: { id: string; price: number; title: string; sku: string },
    options?: {
      customerId?: string;
      email?: string;
      guestToken?: string;
      quantity?: number;
    },
  ): Promise<string> {
    const checkoutId = generateUuidV7();
    const cartId = generateUuidV7();
    const quantity = options?.quantity ?? 1;
    const total = variant.price * quantity;
    const email = options?.email ?? "buyer@example.com";
    const guestTokenHash = options?.guestToken
      ? createHash("sha256").update(options.guestToken).digest("hex")
      : null;

    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );

    const addressSnapshot = JSON.stringify({
      name: "Jane Shopper",
      firstName: "Jane",
      lastName: "Shopper",
      addressLine1: "123 Main St",
      city: "New York",
      state: "NY",
      postalCode: "10001",
      country: "US",
    });

    await db.query(
      `INSERT INTO checkouts (
         id, store_id, cart_id, customer_id, guest_token_hash, subtotal, tax_total, shipping_total,
         discount_total, total, status, currency, email, shipping_address, billing_address
       ) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 0, $6, 'OPEN', 'USD', $7, $8, $8)`,
      [
        checkoutId,
        storeId,
        cartId,
        options?.customerId ?? null,
        guestTokenHash,
        total,
        email,
        addressSnapshot,
      ],
    );

    await db.query(
      `INSERT INTO checkout_items (
         id, checkout_id, store_id, variant_id, product_name_snapshot,
         variant_name_snapshot, sku_snapshot, unit_price, quantity, line_total
       ) VALUES ($1, $2, $3, $4, 'Product Snapshot', $5, $6, $7, $8, $9)`,
      [
        generateUuidV7(),
        checkoutId,
        storeId,
        variant.id,
        variant.title,
        variant.sku,
        variant.price,
        quantity,
        total,
      ],
    );

    return checkoutId;
  }

  it("completes full commerce lifecycle from storefront cart to payment, order, fulfillment, and refund", async () => {
    // 1. Merchant Setup: Store, Product, Variant, Inventory
    const { storeId, merchantUserId } = await seedTestStore("lifecycle-demo-store");

    const product = await productService.createProduct(db, storeId, {
      title: "Mechanical Keyboard",
      slug: "mech-keyboard",
      description: "Custom mechanical keyboard",
      status: "ACTIVE",
    });

    const variant = await productService.createVariant(db, storeId, product.id, {
      title: "Tactile Brown Switches",
      sku: "KB-BRN-001",
      price: 15000, // $150.00
      currency: "USD",
      inventoryQuantity: 5,
    });

    // Initialize inventory record with 5 available items
    await inventoryService.adjustStock(db, storeId, variant.id, {
      quantityDelta: 5,
      reason: "INITIAL_STOCK",
      referenceType: "seed",
      referenceId: generateUuidV7(),
    });

    // Customer
    const customer = await customerService.createCustomer(db, storeId, {
      email: "buyer@example.com",
      firstName: "Jane",
      lastName: "Shopper",
      phone: "+15551234567",
    });

    // 2. Checkout: Initialize checkout with shipping address
    const guestToken = "gst_test_token_lifecycle_12345";
    const checkoutId = await seedTestCheckout(storeId, variant, {
      customerId: customer.id,
      email: customer.email,
      guestToken,
      quantity: 1,
    });

    // 3. Payment Initiation Route: Stock reservation & Razorpay Gateway Order creation
    const initReq = new Request(
      `http://localhost/api/v1/storefront/lifecycle-demo-store/checkout/${checkoutId}/payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guest-token": guestToken,
        },
      },
    );

    const initRes = await initiatePaymentRoute(initReq, {
      params: Promise.resolve({
        storeSlug: "lifecycle-demo-store",
        checkoutId,
      }),
    });

    expect(initRes.status).toBe(200);
    const initJson = await initRes.json();
    expect(initJson.success).toBe(true);
    expect(initJson.data.payment.status).toBe("CREATED");
    expect(initJson.data.attempt.status).toBe("INITIATED");
    expect(initJson.data.razorpayOrder.providerOrderId).toBeDefined();

    const providerOrderId = initJson.data.razorpayOrder.providerOrderId;
    const paymentId = initJson.data.payment.id;
    const attemptId = initJson.data.attempt.id;

    // Verify stock was reserved under referenceType = 'checkout'
    const reservationsBeforeOrder = await db.query<{
      status: string;
      reference_type: string;
      reference_id: string;
      quantity: number;
    }>(
      `SELECT status, reference_type, reference_id, quantity FROM inventory_reservations WHERE store_id = $1 AND reference_id = $2`,
      [storeId, checkoutId],
    );
    expect(reservationsBeforeOrder.rows).toHaveLength(1);
    expect(reservationsBeforeOrder.rows[0]?.status).toBe("ACTIVE");
    expect(reservationsBeforeOrder.rows[0]?.reference_type).toBe("checkout");

    // 4. Payment Verification Route: Verify HMAC signature and complete purchase
    const razorpayPaymentId = `pay_mock_${Date.now()}_15000_USD_${providerOrderId}`;
    const signature = computeValidCallbackSignature(providerOrderId, razorpayPaymentId);

    const verifyReq = new Request(
      `http://localhost/api/v1/storefront/lifecycle-demo-store/checkout/${checkoutId}/payment/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guest-token": guestToken,
        },
        body: JSON.stringify({
          paymentId,
          attemptId,
          razorpayPaymentId,
          razorpayOrderId: providerOrderId,
          razorpaySignature: signature,
        }),
      },
    );

    const verifyRes = await verifyPaymentRoute(verifyReq, {
      params: Promise.resolve({
        storeSlug: "lifecycle-demo-store",
        checkoutId,
      }),
    });

    expect(verifyRes.status).toBe(200);
    const verifyJson = await verifyRes.json();
    expect(verifyJson.success).toBe(true);
    expect(verifyJson.data.verified).toBe(true);
    expect(verifyJson.data.paymentStatus).toBe("CAPTURED");

    // Verify order was created
    const createdOrder = await orderService.getOrderByCheckoutId(db, storeId, checkoutId);
    expect(createdOrder).not.toBeNull();
    expect(createdOrder?.paymentStatus).toBe("PAID");
    expect(Number(createdOrder?.total)).toBe(15000);

    // Verify inventory reservation was transferred to order reference
    const reservationsAfterOrder = await db.query<{
      status: string;
      reference_type: string;
      reference_id: string;
    }>(
      `SELECT status, reference_type, reference_id FROM inventory_reservations WHERE store_id = $1 AND reference_id = $2`,
      [storeId, createdOrder!.id],
    );
    expect(reservationsAfterOrder.rows).toHaveLength(1);
    expect(reservationsAfterOrder.rows[0]?.reference_type).toBe("order");
    expect(reservationsAfterOrder.rows[0]?.reference_id).toBe(createdOrder!.id);

    // 5. Idempotency: Duplicate payment verify request does NOT recreate order
    const repeatVerifyReq = new Request(
      `http://localhost/api/v1/storefront/lifecycle-demo-store/checkout/${checkoutId}/payment/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guest-token": guestToken,
        },
        body: JSON.stringify({
          paymentId,
          attemptId,
          razorpayPaymentId,
          razorpayOrderId: providerOrderId,
          razorpaySignature: signature,
        }),
      },
    );

    const repeatVerifyRes = await verifyPaymentRoute(repeatVerifyReq, {
      params: Promise.resolve({
        storeSlug: "lifecycle-demo-store",
        checkoutId,
      }),
    });
    expect(repeatVerifyRes.status).toBe(200);
    const orderCount = await db.query<{ count: string }>(
      `SELECT count(*) FROM orders WHERE store_id = $1 AND checkout_id = $2`,
      [storeId, checkoutId],
    );
    expect(Number(orderCount.rows[0]?.count)).toBe(1);

    // 6. Merchant Order Management: Merchant updates fulfillment
    const fulfilledOrder = await orderStatusService.updateFulfillmentStatus(db, {
      storeId,
      orderId: createdOrder!.id,
      fulfillmentStatus: "FULFILLED",
      trackingCarrier: "FedEx",
      trackingNumber: "FX1234567890",
      reason: "Shipped via FedEx Express",
      actorType: "MERCHANT",
      actorId: merchantUserId,
    });
    expect(fulfilledOrder.fulfillmentStatus).toBe("FULFILLED");

    // 7. Merchant Cancellation & Refund Workflow
    // Cancellation coordinator releases order inventory and triggers refund
    const cancelRes = await cancellationCoordinator.cancelOrder(db, {
      storeId,
      orderId: createdOrder!.id,
      reason: "Customer requested cancellation before delivery",
      actorType: "MERCHANT",
      actorId: merchantUserId,
    });

    expect(cancelRes.order.status).toBe("CANCELLED");
    expect(cancelRes.inventory.released).toBe(true);

    // Verify reservation was released
    const releasedReservations = await db.query<{ status: string }>(
      `SELECT status FROM inventory_reservations WHERE store_id = $1 AND reference_id = $2`,
      [storeId, createdOrder!.id],
    );
    expect(releasedReservations.rows[0]?.status).toBe("RELEASED");

    // 8. Tenant Boundary Protection: Store B cannot access Store A's orders or payments
    const { storeId: storeBId } = await seedTestStore("competing-store-b");
    const crossStoreOrder = await orderService.getOrderById(db, storeBId, createdOrder!.id);
    expect(crossStoreOrder).toBeNull();

    await expect(
      orderStatusService.cancelOrder(db, {
        storeId: storeBId,
        orderId: createdOrder!.id,
        reason: "Malicious cross-tenant attempt",
      }),
    ).rejects.toThrow();
  });

  it("prevents inventory overselling when competing checkouts contest scarce inventory", async () => {
    const { storeId } = await seedTestStore("oversell-test-store");

    const product = await productService.createProduct(db, storeId, {
      title: "Limited Edition Watch",
      slug: "ltd-watch",
      status: "ACTIVE",
    });

    const variant = await productService.createVariant(db, storeId, product.id, {
      title: "Edition 1/1",
      sku: "WATCH-LTD-1",
      price: 50000,
      currency: "USD",
    });

    // Initialize inventory with exactly 1 available unit
    await inventoryService.adjustStock(db, storeId, variant.id, {
      quantityDelta: 1,
      reason: "INITIAL_STOCK",
      referenceType: "init",
      referenceId: generateUuidV7(),
    });

    // Shopper A checkout
    const checkoutAId = await seedTestCheckout(storeId, variant, {
      guestToken: "guest_shopper_a",
      email: "shopper.a@example.com",
    });

    // Shopper B checkout
    const checkoutBId = await seedTestCheckout(storeId, variant, {
      guestToken: "guest_shopper_b",
      email: "shopper.b@example.com",
    });

    // Shopper A initiates payment -> succeeds, reserving the 1 unit
    const reqA = new Request(
      `http://localhost/api/v1/storefront/oversell-test-store/checkout/${checkoutAId}/payment`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": "guest_shopper_a" },
      },
    );
    const resA = await initiatePaymentRoute(reqA, {
      params: Promise.resolve({ storeSlug: "oversell-test-store", checkoutId: checkoutAId }),
    });
    expect(resA.status).toBe(200);

    // Shopper B attempts to initiate payment -> fails with 409 INSUFFICIENT_STOCK
    const reqB = new Request(
      `http://localhost/api/v1/storefront/oversell-test-store/checkout/${checkoutBId}/payment`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": "guest_shopper_b" },
      },
    );
    const resB = await initiatePaymentRoute(reqB, {
      params: Promise.resolve({ storeSlug: "oversell-test-store", checkoutId: checkoutBId }),
    });
    expect(resB.status).toBe(409);
    const jsonB = await resB.json();
    expect(jsonB.error.code).toBe("INSUFFICIENT_INVENTORY");
  });

  it("releases reserved inventory immediately when a checkout is cancelled", async () => {
    const { storeId, sessionId } = await seedTestStore("cancel-checkout-store");

    const product = await productService.createProduct(db, storeId, {
      title: "Rare Item",
      slug: "rare-item",
      status: "ACTIVE",
    });

    const variant = await productService.createVariant(db, storeId, product.id, {
      title: "Standard",
      sku: "RARE-001",
      price: 10000,
      currency: "USD",
    });

    await inventoryService.adjustStock(db, storeId, variant.id, {
      quantityDelta: 1,
      reason: "INITIAL_STOCK",
      referenceType: "init",
      referenceId: generateUuidV7(),
    });

    const checkoutId = await seedTestCheckout(storeId, variant, {
      guestToken: "guest_cancel_tester",
      email: "test@example.com",
    });

    // Initiate payment to create reservation
    const req = new Request(
      `http://localhost/api/v1/storefront/cancel-checkout-store/checkout/${checkoutId}/payment`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": "guest_cancel_tester" },
      },
    );
    const res = await initiatePaymentRoute(req, {
      params: Promise.resolve({ storeSlug: "cancel-checkout-store", checkoutId }),
    });
    expect(res.status).toBe(200);

    // Verify reservation is ACTIVE
    const activeRes = await db.query<{ status: string }>(
      `SELECT status FROM inventory_reservations WHERE store_id = $1 AND reference_id = $2`,
      [storeId, checkoutId],
    );
    expect(activeRes.rows[0]?.status).toBe("ACTIVE");

    // Merchant cancels checkout
    const cancelReq = new Request(
      `http://localhost/api/v1/stores/${storeId}/checkouts/${checkoutId}/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionId}`,
        },
      },
    );

    const cancelRes = await cancelCheckoutRoute(cancelReq, {
      params: Promise.resolve({ storeId, checkoutId }),
    });
    expect(cancelRes.status).toBe(200);

    // Verify reservation is now RELEASED
    const releasedRes = await db.query<{ status: string }>(
      `SELECT status FROM inventory_reservations WHERE store_id = $1 AND reference_id = $2`,
      [storeId, checkoutId],
    );
    expect(releasedRes.rows[0]?.status).toBe("RELEASED");

    // Available inventory is back to 1
    const availability = await inventoryService.getAvailability(db, storeId, variant.id);
    expect(availability.availableQuantity).toBe(1);
  });
});
