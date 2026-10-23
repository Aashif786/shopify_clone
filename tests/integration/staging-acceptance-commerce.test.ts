import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
  OrderRepository,
} from "@shopify-clone/db";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import {
  InventoryService,
  ReservationReleaseService,
  InsufficientStockError,
  CrossStoreInventoryAccessError,
} from "../../modules/inventory/src/index.js";
import {
  RefundService,
  CrossStorePaymentAccessError,
} from "../../modules/payments/src/index.js";
import {
  AnalyticsService,
  OrderCancellationCoordinator,
  OrderStatusService,
  CrossStoreOrderAccessError,
} from "../../modules/orders/src/index.js";
import { DiscountService } from "../../modules/discounts/src/index.js";

describe("Integrated Staging Acceptance & Release Gate Commerce Workflows", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;

  const inventoryService = new InventoryService();
  const reservationReleaseService = new ReservationReleaseService();
  const refundService = new RefundService();
  const analyticsService = new AnalyticsService();
  const discountService = new DiscountService();
  const orderCoordinator = new OrderCancellationCoordinator(
    new OrderStatusService(),
    new OrderRepository(),
    reservationReleaseService,
  );

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
  });

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function seedStoreWithCatalog(
    storeName: string,
    initialStock = 20,
    priceMinor = 10000, // $100.00
  ): Promise<{
    orgId: string;
    storeId: string;
    productId: string;
    variantId: string;
    inventoryItemId: string;
  }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const inventoryItemId = generateUuidV7();

    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`, [
      orgId,
      `Org ${storeName}`,
    ]);

    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'UTC')`,
      [storeId, orgId, storeName, `slug-${storeId}`],
    );

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Artisan Coffee Roaster', $3, 'ACTIVE')`,
      [productId, storeId, `roaster-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`],
    );

    await db.query(
      `INSERT INTO product_variants (id, store_id, product_id, title, price, sku, currency, status)
       VALUES ($1, $2, $3, 'Matte Black', $4, $5, 'USD', 'ACTIVE')`,
      [variantId, storeId, productId, priceMinor, `SKU-${Date.now()}`],
    );

    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, $4, 0)`,
      [inventoryItemId, storeId, variantId, initialStock],
    );

    return { orgId, storeId, productId, variantId, inventoryItemId };
  }

  async function seedCustomer(storeId: string, email = "customer@example.com"): Promise<string> {
    const customerId = generateUuidV7();
    await db.query(
      `INSERT INTO customers (id, store_id, email, first_name, last_name)
       VALUES ($1, $2, $3, 'Jane', 'Doe')`,
      [customerId, storeId, email],
    );
    return customerId;
  }

  // =========================================================================
  // SCENARIO A: Complete Successful Order Lifecycle & Financial Metrics
  // =========================================================================
  it("Scenario A: Complete successful order with discount, inventory commit, and verified financial aggregation", async () => {
    const initialStock = 20;
    const unitPrice = 10000; // $100.00
    const discountAmount = 1500; // $15.00
    const shippingAmount = 800; // $8.00
    const taxAmount = 400; // $4.00
    const grandTotal = unitPrice - discountAmount + shippingAmount + taxAmount; // $97.00 = 9700 cents

    const { storeId, variantId } = await seedStoreWithCatalog("Store Scenario A", initialStock, unitPrice);
    const customerId = await seedCustomer(storeId, "scenario_a@example.com");

    // 1. Create discount code via DiscountService
    const discount = await discountService.createDiscount(db, storeId, {
      code: "WELCOME15",
      name: "Welcome 15 Off",
      type: "FIXED_AMOUNT",
      value: discountAmount,
      currency: "USD",
      status: "ACTIVE",
    });
    expect(discount.code).toBe("WELCOME15");

    // 2. Reserve inventory for checkout (demanded = 2)
    const checkoutRefId = generateUuidV7();
    const reservation = await inventoryService.reserve(db, storeId, {
      variantId,
      quantity: 2,
      referenceType: "checkout",
      referenceId: checkoutRefId,
    });
    expect(reservation.status).toBe("ACTIVE");
    expect(reservation.quantity).toBe(2);

    // Verify stock during reservation: available decreased by 2, reserved increased by 2
    const stockDuringHold = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(stockDuringHold.availableQuantity).toBe(initialStock - 2);
    expect(stockDuringHold.reservedQuantity).toBe(2);

    // 3. Complete checkout and create confirmed order
    const orderId = generateUuidV7();
    const cartId = generateUuidV7();
    const paymentId = generateUuidV7();

    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );

    await db.query(
      `INSERT INTO checkouts (
         id, store_id, cart_id, customer_id, status, currency,
         total, subtotal, discount_total, tax_total, shipping_total, payment_status
       ) VALUES ($1, $2, $3, $4, 'COMPLETED', 'USD', $5, $6, $7, $8, $9, 'PAID')`,
      [checkoutRefId, storeId, cartId, customerId, grandTotal, unitPrice, discountAmount, taxAmount, shippingAmount],
    );

    await db.query(
      `INSERT INTO orders (
         id, store_id, customer_id, checkout_id, order_number, status, payment_status,
         fulfillment_status, currency, subtotal, discount_total, shipping_total, tax_total,
         grand_total, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', $6, $7, $8, $9, $10, NOW(), NOW())`,
      [orderId, storeId, customerId, checkoutRefId, `ORD-${Date.now()}`, unitPrice, discountAmount, shippingAmount, taxAmount, grandTotal],
    );

    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, order_id, amount, currency, status, provider,
         captured_amount, refunded_amount, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'USD', 'CAPTURED', 'razorpay', $5, 0, NOW(), NOW())`,
      [paymentId, storeId, checkoutRefId, orderId, grandTotal],
    );

    // 4. Finalize inventory reservation (converts hold to permanent reduction)
    const finalizedRes = await inventoryService.finalizeReservation(db, storeId, reservation.id);
    expect(finalizedRes.status).toBe("COMMITTED");

    // Invariant: Available stock remains decremented, reserved returns to 0
    const stockAfterCommit = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(stockAfterCommit.availableQuantity).toBe(initialStock - 2);
    expect(stockAfterCommit.reservedQuantity).toBe(0);

    // 5. Query Merchant Analytics
    const overview = await analyticsService.getSalesOverview(db, storeId, { preset: "30d" });

    // Financial Reconciliation Invariants:
    // - grossSales is strictly merchandise subtotal before discount ($100.00 = 10000)
    // - discounts is $15.00 (1500)
    // - refunds is 0
    // - netSales = grossSales - discounts - refunds ($85.00 = 8500)
    // - totalSales = netSales + shipping + tax ($85 + $8 + $4 = $97.00 = 9700)
    // - orderCount = 1
    // - averageOrderValue = 8500
    expect(overview.current.grossSales).toBe(unitPrice);
    expect(overview.current.discounts).toBe(discountAmount);
    expect(overview.current.refunds).toBe(0);
    expect(overview.current.netSales).toBe(unitPrice - discountAmount);
    expect(overview.current.orderCount).toBe(1);
    expect(overview.current.averageOrderValue).toBe(unitPrice - discountAmount);
    expect(overview.current.shippingTotal).toBe(shippingAmount);
    expect(overview.current.taxTotal).toBe(taxAmount);
    expect(overview.current.totalSales).toBe(grandTotal);
  });

  // =========================================================================
  // SCENARIO B: Failed / Abandoned Checkout & Inventory Stock Release
  // =========================================================================
  it("Scenario B: Abandoned checkout releases inventory reservation without impacting analytics", async () => {
    const initialStock = 10;
    const { storeId, variantId } = await seedStoreWithCatalog("Store Scenario B", initialStock);

    // 1. Customer initiates checkout, reserving 3 units
    const checkoutRefId = generateUuidV7();
    const reservation = await inventoryService.reserve(db, storeId, {
      variantId,
      quantity: 3,
      referenceType: "checkout",
      referenceId: checkoutRefId,
    });
    expect(reservation.status).toBe("ACTIVE");

    // Stock held
    const stockDuringHold = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(stockDuringHold.availableQuantity).toBe(7);
    expect(stockDuringHold.reservedQuantity).toBe(3);

    // 2. Checkout abandoned / expired / failed -> release reservation
    const releasedRes = await inventoryService.releaseReservation(db, storeId, reservation.id);
    expect(releasedRes.status).toBe("RELEASED");

    // Stock fully restored to available pool
    const stockRestored = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(stockRestored.availableQuantity).toBe(initialStock);
    expect(stockRestored.reservedQuantity).toBe(0);

    // Record failed payment / abandoned checkout (no order created)
    const cartId = generateUuidV7();
    await db.query(`INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`, [cartId, storeId]);
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, 30000, 'EXPIRED', 'FAILED', 'USD')`,
      [checkoutRefId, storeId, cartId],
    );

    // 3. Analytics verification: Zero recognized revenue, zero orders
    const overview = await analyticsService.getSalesOverview(db, storeId, { preset: "30d" });
    expect(overview.current.grossSales).toBe(0);
    expect(overview.current.netSales).toBe(0);
    expect(overview.current.orderCount).toBe(0);
    expect(overview.current.refunds).toBe(0);
    expect(overview.current.totalSales).toBe(0);
  });

  // =========================================================================
  // SCENARIO C: Partial Refund vs. Ambiguous/Failed Refunds
  // =========================================================================
  it("Scenario C: Partial succeeded refund reduces net sales; failed and pending refunds are excluded", async () => {
    const initialStock = 15;
    const orderTotal = 25000; // $250.00
    const { storeId, variantId } = await seedStoreWithCatalog("Store Scenario C", initialStock, orderTotal);
    const customerId = await seedCustomer(storeId, "scenario_c@example.com");

    const orderId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const paymentId = generateUuidV7();
    const cartId = generateUuidV7();

    await db.query(`INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`, [cartId, storeId]);
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, customer_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, $4, $5, 'COMPLETED', 'PAID', 'USD')`,
      [checkoutId, storeId, cartId, customerId, orderTotal],
    );

    await db.query(
      `INSERT INTO orders (
         id, store_id, customer_id, checkout_id, order_number, status, payment_status,
         fulfillment_status, currency, subtotal, discount_total, shipping_total, tax_total, grand_total,
         created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED', 'PARTIALLY_REFUNDED', 'FULFILLED', 'USD', $6, 0, 0, 0, $6, NOW(), NOW())`,
      [orderId, storeId, customerId, checkoutId, `ORD-${Date.now()}`, orderTotal],
    );

    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, order_id, amount, currency, status, provider,
         captured_amount, refunded_amount, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'USD', 'PARTIALLY_REFUNDED', 'razorpay', $5, 6000, NOW(), NOW())`,
      [paymentId, storeId, checkoutId, orderId, orderTotal],
    );

    // Seed 3 refund entries:
    // 1. Succeeded partial refund: $60.00 (6000 cents) -> MUST be counted in analytics
    const refundSucceededId = generateUuidV7();
    await db.query(
      `INSERT INTO refunds (id, store_id, payment_id, order_id, amount, currency, status, reason, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 6000, 'USD', 'SUCCEEDED', 'Customer satisfaction', NOW() - INTERVAL '1 second', NOW() - INTERVAL '1 second')`,
      [refundSucceededId, storeId, paymentId, orderId],
    );

    // 2. Failed refund attempt: $40.00 (4000 cents) -> MUST BE EXCLUDED
    const refundFailedId = generateUuidV7();
    await db.query(
      `INSERT INTO refunds (id, store_id, payment_id, order_id, amount, currency, status, reason, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 4000, 'USD', 'FAILED', 'Bank gateway timeout', NOW() - INTERVAL '1 second', NOW() - INTERVAL '1 second')`,
      [refundFailedId, storeId, paymentId, orderId],
    );

    // 3. Ambiguous in-flight refund: $20.00 (2000 cents) -> MUST BE EXCLUDED
    const refundAmbiguousId = generateUuidV7();
    await db.query(
      `INSERT INTO refunds (id, store_id, payment_id, order_id, amount, currency, status, reason, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 2000, 'USD', 'REQUIRES_RECONCILIATION', 'Pending webhook verification', NOW() - INTERVAL '1 second', NOW() - INTERVAL '1 second')`,
      [refundAmbiguousId, storeId, paymentId, orderId],
    );

    // Query Analytics
    const overview = await analyticsService.getSalesOverview(db, storeId, { preset: "30d" });

    // Financial Reconciliation Invariants:
    // - grossSales: $250.00 (25000)
    // - discounts: 0
    // - refunds: 6000 (only SUCCEEDED refund counted; FAILED and REQUIRES_RECONCILIATION strictly excluded)
    // - netSales: 25000 - 0 - 6000 = 19000 ($190.00)
    // - orderCount: 1
    // - averageOrderValue: 19000
    expect(overview.current.grossSales).toBe(25000);
    expect(overview.current.refunds).toBe(6000);
    expect(overview.current.netSales).toBe(19000);
    expect(overview.current.orderCount).toBe(1);
    expect(overview.current.averageOrderValue).toBe(19000);

    // Inventory Invariant: Succeeded refund on fulfilled order does not restore inventory automatically
    const stockAfterRefund = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(stockAfterRefund.availableQuantity).toBe(initialStock);
    expect(stockAfterRefund.reservedQuantity).toBe(0);
  });

  // =========================================================================
  // SCENARIO D: Full Refund & Order Cancellation Reconciling to $0 Net Sales
  // =========================================================================
  it("Scenario D1: Full cancellation and refund reconciles net sales to zero and releases inventory", async () => {
    const initialStock = 12;
    const orderTotal = 15000; // $150.00
    const { storeId, variantId, inventoryItemId } = await seedStoreWithCatalog("Store Scenario D1", initialStock, orderTotal);
    const customerId = await seedCustomer(storeId, "scenario_d1@example.com");

    const orderId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const paymentId = generateUuidV7();
    const cartId = generateUuidV7();

    // 1. Create order with active inventory reservation
    const reservationId = generateUuidV7();
    await db.query(
      `INSERT INTO inventory_reservations (
         id, store_id, inventory_item_id, reference_type, reference_id,
         quantity, status, expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, 'order', $4, 2, 'ACTIVE', NOW() + INTERVAL '1 hour', NOW(), NOW())`,
      [reservationId, storeId, inventoryItemId, orderId],
    );
    await db.query(
      `UPDATE inventory_items SET available_quantity = $1, reserved_quantity = 2 WHERE id = $2`,
      [initialStock - 2, inventoryItemId],
    );

    await db.query(`INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`, [cartId, storeId]);
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, customer_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, $4, $5, 'COMPLETED', 'PAID', 'USD')`,
      [checkoutId, storeId, cartId, customerId, orderTotal],
    );

    await db.query(
      `INSERT INTO orders (
         id, store_id, customer_id, checkout_id, order_number, status, payment_status,
         fulfillment_status, currency, subtotal, discount_total, shipping_total, tax_total, grand_total,
         created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', $6, 0, 0, 0, $6, NOW(), NOW())`,
      [orderId, storeId, customerId, checkoutId, `ORD-${Date.now()}`, orderTotal],
    );

    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, order_id, amount, currency, status, provider,
         captured_amount, refunded_amount, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'USD', 'CAPTURED', 'razorpay', $5, 0, NOW(), NOW())`,
      [paymentId, storeId, checkoutId, orderId, orderTotal],
    );

    // 2. Cancel order via OrderCancellationCoordinator
    const cancelResult = await orderCoordinator.cancelOrder(db, {
      storeId,
      orderId,
      reason: "Customer cancelled prior to shipping",
      actorType: "MERCHANT",
    });
    expect(cancelResult.order.status).toBe("CANCELLED");
    expect(cancelResult.inventory.releasedCount).toBe(1);

    // Invariant: Stock reservation released back to available pool
    const stockAfterCancel = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(stockAfterCancel.availableQuantity).toBe(initialStock);
    expect(stockAfterCancel.reservedQuantity).toBe(0);

    // Record full succeeded refund
    const refundId = generateUuidV7();
    await db.query(
      `INSERT INTO refunds (id, store_id, payment_id, order_id, amount, currency, status, reason, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'USD', 'SUCCEEDED', 'Full refund on cancellation', NOW() - INTERVAL '1 second', NOW() - INTERVAL '1 second')`,
      [refundId, storeId, paymentId, orderId, orderTotal],
    );

    await db.query(
      `UPDATE payments SET status = 'REFUNDED', refunded_amount = $1 WHERE id = $2`,
      [orderTotal, paymentId],
    );

    // 3. Query Analytics
    const overview = await analyticsService.getSalesOverview(db, storeId, { preset: "30d" });

    // Invariant:
    // - Paid cancelled order has gross sales = $150 (15000)
    // - Full refund = $150 (15000)
    // - Net sales balances cleanly to 0 ($150 - $150 = 0)
    // - Cancelled order is excluded from active order count (orderCount = 0)
    // - AOV is 0
    expect(overview.current.grossSales).toBe(orderTotal);
    expect(overview.current.refunds).toBe(orderTotal);
    expect(overview.current.netSales).toBe(0);
    expect(overview.current.orderCount).toBe(0);
    expect(overview.current.averageOrderValue).toBe(0);
  });

  it("Scenario D2: Authentic negative AOV reporting when refunds exceed gross sales (verifying Math.max clamp removal)", async () => {
    const { storeId } = await seedStoreWithCatalog("Store Scenario D2", 10, 5000);
    const customerId = await seedCustomer(storeId, "scenario_d2@example.com");

    const orderId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const paymentId = generateUuidV7();
    const cartId = generateUuidV7();

    // 1 order with gross sales = $50.00 (5000 cents)
    await db.query(`INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`, [cartId, storeId]);
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, customer_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, $4, 5000, 'COMPLETED', 'PAID', 'USD')`,
      [checkoutId, storeId, cartId, customerId],
    );

    await db.query(
      `INSERT INTO orders (
         id, store_id, customer_id, checkout_id, order_number, status, payment_status,
         fulfillment_status, currency, subtotal, discount_total, shipping_total, tax_total, grand_total,
         created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', 5000, 0, 0, 0, 5000, NOW(), NOW())`,
      [orderId, storeId, customerId, checkoutId, `ORD-${Date.now()}`],
    );

    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, order_id, amount, currency, status, provider,
         captured_amount, refunded_amount, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 5000, 'USD', 'CAPTURED', 'razorpay', 5000, 0, NOW(), NOW())`,
      [paymentId, storeId, checkoutId, orderId],
    );

    // Succeeded refunds = $90.00 (9000 cents) in this period (e.g., refunding previous period items)
    const refundId = generateUuidV7();
    await db.query(
      `INSERT INTO refunds (id, store_id, payment_id, order_id, amount, currency, status, reason, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 9000, 'USD', 'SUCCEEDED', 'Cross-period charge adjustment', NOW() - INTERVAL '1 second', NOW() - INTERVAL '1 second')`,
      [refundId, storeId, paymentId, orderId],
    );

    const overview = await analyticsService.getSalesOverview(db, storeId, { preset: "30d" });

    // Financial Invariant:
    // - Gross sales = 5000
    // - Refunds = 9000
    // - Net sales = -4000
    // - Orders = 1
    // - AOV must be -4000 (-4000 / 1), NOT clamped to 0!
    expect(overview.current.grossSales).toBe(5000);
    expect(overview.current.refunds).toBe(9000);
    expect(overview.current.netSales).toBe(-4000);
    expect(overview.current.orderCount).toBe(1);
    expect(overview.current.averageOrderValue).toBe(-4000);
  });

  // =========================================================================
  // SCENARIO E: Multi-Store Multi-Tenant Isolation & Parameter Tampering
  // =========================================================================
  it("Scenario E: Strict tenant boundary enforcement across analytics, order cancellation, refunds, and inventory", async () => {
    // 1. Seed two completely separate stores
    const storeA = await seedStoreWithCatalog("Store Alpha", 20, 10000);
    const storeB = await seedStoreWithCatalog("Store Beta", 20, 10000);

    const customerA = await seedCustomer(storeA.storeId, "custa@example.com");

    // Store A has 1 confirmed paid order of $100.00
    const orderAId = generateUuidV7();
    const checkoutAId = generateUuidV7();
    const paymentAId = generateUuidV7();
    const cartAId = generateUuidV7();

    await db.query(`INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`, [cartAId, storeA.storeId]);
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, customer_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, $4, 10000, 'COMPLETED', 'PAID', 'USD')`,
      [checkoutAId, storeA.storeId, cartAId, customerA],
    );

    await db.query(
      `INSERT INTO orders (
         id, store_id, customer_id, checkout_id, order_number, status, payment_status,
         fulfillment_status, currency, subtotal, discount_total, shipping_total, tax_total, grand_total,
         created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', 10000, 0, 0, 0, 10000, NOW(), NOW())`,
      [orderAId, storeA.storeId, customerA, checkoutAId, `ORD-A-${Date.now()}`],
    );

    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, order_id, amount, currency, status, provider,
         captured_amount, refunded_amount, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 10000, 'USD', 'CAPTURED', 'razorpay', 10000, 0, NOW(), NOW())`,
      [paymentAId, storeA.storeId, checkoutAId, orderAId],
    );

    // 2. Tenant Isolation in Analytics: Store B sees strictly 0, zero data leakage from Store A
    const overviewB = await analyticsService.getSalesOverview(db, storeB.storeId, { preset: "30d" });
    expect(overviewB.current.grossSales).toBe(0);
    expect(overviewB.current.netSales).toBe(0);
    expect(overviewB.current.orderCount).toBe(0);
    expect(overviewB.current.refunds).toBe(0);

    // 3. Cross-Tenant Order Cancellation Tampering: Store B cannot cancel Store A's order
    await expect(
      orderCoordinator.cancelOrder(db, {
        storeId: storeB.storeId,
        orderId: orderAId,
        reason: "Malicious attempt to cancel rival store order",
        actorType: "MERCHANT",
      }),
    ).rejects.toThrow(CrossStoreOrderAccessError);

    // 4. Cross-Tenant Refund Tampering: Store B cannot refund Store A's payment
    await expect(
      refundService.requestRefund(db, {
        storeId: storeB.storeId,
        paymentId: paymentAId,
        amount: 5000,
        idempotencyKey: "malicious-cross-refund-attempt",
      }),
    ).rejects.toThrow(CrossStorePaymentAccessError);

    // 5. Cross-Tenant Inventory Reservation Tampering: Store B cannot reserve Store A's variant
    await expect(
      inventoryService.reserve(db, storeB.storeId, {
        variantId: storeA.variantId,
        quantity: 1,
        referenceType: "checkout",
        referenceId: generateUuidV7(),
      }),
    ).rejects.toThrow(CrossStoreInventoryAccessError);
  });

  // =========================================================================
  // INVENTORY OVERSELLING PREVENTION & CONCURRENCY INVARIANTS
  // =========================================================================
  it("Inventory Invariant: Strict overselling prevention and available stock floor protection", async () => {
    // Stock is exactly 1 unit
    const { storeId, variantId } = await seedStoreWithCatalog("Store Stock Guard", 1);

    // 1. Attempting to reserve 2 units must fail immediately with InsufficientStockError
    await expect(
      inventoryService.reserve(db, storeId, {
        variantId,
        quantity: 2,
        referenceType: "checkout",
        referenceId: generateUuidV7(),
      }),
    ).rejects.toThrow(InsufficientStockError);

    // Available stock remains untouched at 1
    const check1 = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(check1.availableQuantity).toBe(1);
    expect(check1.reservedQuantity).toBe(0);

    // 2. First checkout reserves the 1 unit -> succeeds
    const checkout1Ref = generateUuidV7();
    const res1 = await inventoryService.reserve(db, storeId, {
      variantId,
      quantity: 1,
      referenceType: "checkout",
      referenceId: checkout1Ref,
    });
    expect(res1.status).toBe("ACTIVE");

    const check2 = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(check2.availableQuantity).toBe(0);
    expect(check2.reservedQuantity).toBe(1);

    // 3. Second concurrent checkout attempts to reserve 1 unit -> must be rejected with InsufficientStockError
    const checkout2Ref = generateUuidV7();
    await expect(
      inventoryService.reserve(db, storeId, {
        variantId,
        quantity: 1,
        referenceType: "checkout",
        referenceId: checkout2Ref,
      }),
    ).rejects.toThrow(InsufficientStockError);

    // Invariant: Available stock never drops below 0
    const check3 = await inventoryService.getInventoryItem(db, storeId, variantId);
    expect(check3.availableQuantity).toBe(0);
    expect(check3.reservedQuantity).toBe(1);
  });
});
