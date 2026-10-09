import { afterEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
  PaymentRepository,
  RefundRepository,
} from "@shopify-clone/db";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import {
  InventoryService,
  ReservationReleaseService,
} from "../../modules/inventory/src/index.js";
import { OrderCancellationRefundService } from "../../modules/payments/src/index.js";
import { OrderCancellationCoordinator } from "../../modules/orders/src/index.js";
import { OrderCancellationRecoveryJob } from "../../apps/worker/src/jobs/orders/order-cancellation-recovery-job.js";

describe("Order Cancellation Workflow E2E Integration Tests", { timeout: 30_000 }, () => {
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

  async function seedFullCommerceAggregate(
    db: Database,
    options: {
      initialStock?: number;
      reserveQuantity?: number;
      paymentAmount?: number;
    } = {},
  ): Promise<{
    storeId: string;
    orderId: string;
    checkoutId: string;
    paymentId: string;
    variantId: string;
    reservationId: string;
  }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    const customerId = generateUuidV7();
    const cartId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const orderId = generateUuidV7();
    const productId = generateUuidV7();
    const variantId = generateUuidV7();
    const inventoryItemId = generateUuidV7();
    const paymentId = generateUuidV7();
    const attemptId = generateUuidV7();

    const initialStock = options.initialStock ?? 20;
    const reserveQuantity = options.reserveQuantity ?? 2;
    const paymentAmount = options.paymentAmount ?? 5000;

    // 1. Organization & Store
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, 'Org E2E', 'ACTIVE')`,
      [orgId],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, 'Store E2E', $3, 'ACTIVE', 'INR', 'en-IN', 'Asia/Kolkata')`,
      [storeId, orgId, `store-e2e-${Date.now()}`],
    );

    // 2. Customer
    await db.query(
      `INSERT INTO customers (id, store_id, email, first_name, last_name)
       VALUES ($1, $2, 'buyer@example.com', 'Alex', 'Buyer')`,
      [customerId, storeId],
    );

    // 3. Product, Variant & Inventory Item
    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Silk Scarf', $3, 'ACTIVE')`,
      [productId, storeId, `scarf-${Date.now()}`],
    );
    await db.query(
      `INSERT INTO product_variants (id, store_id, product_id, title, price, sku)
       VALUES ($1, $2, $3, 'Ruby Red', $4, $5)`,
      [variantId, storeId, productId, paymentAmount, `SKU-SCARF-${Date.now()}`],
    );
    await db.query(
      `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity)
       VALUES ($1, $2, $3, $4, $5)`,
      [inventoryItemId, storeId, variantId, initialStock - reserveQuantity, reserveQuantity],
    );

    // 4. Cart & Checkout
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, customer_id, status, currency, total)
       VALUES ($1, $2, $3, $4, 'COMPLETED', 'INR', $5)`,
      [checkoutId, storeId, cartId, customerId, paymentAmount],
    );

    // 5. Active Inventory Reservation linked to Order & Checkout
    const reservationId = generateUuidV7();
    await db.query(
      `INSERT INTO inventory_reservations (
         id, store_id, inventory_item_id, reference_type, reference_id,
         quantity, status, expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, 'order', $4, $5, 'ACTIVE', NOW() + INTERVAL '1 hour', NOW(), NOW())`,
      [reservationId, storeId, inventoryItemId, orderId, reserveQuantity],
    );

    // 6. Order (CONFIRMED)
    await db.query(
      `INSERT INTO orders (
         id, store_id, customer_id, checkout_id, order_number, status, payment_status,
         fulfillment_status, currency, subtotal, discount_total, shipping_total,
         tax_total, grand_total, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED', 'PAID', 'UNFULFILLED', 'INR', $6, 0, 0, 0, $6, NOW(), NOW())`,
      [orderId, storeId, customerId, checkoutId, `ORD-${Date.now()}`, paymentAmount],
    );

    // 7. Payment (CAPTURED)
    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, order_id, amount, currency, status, provider,
         captured_amount, refunded_amount, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'INR', 'CAPTURED', 'razorpay', $5, 0, NOW(), NOW())`,
      [paymentId, storeId, checkoutId, orderId, paymentAmount],
    );

    // 8. Payment Attempt
    await db.query(
      `INSERT INTO payment_attempts (
         id, payment_id, store_id, attempt_number, provider, provider_payment_id,
         amount, currency, status, created_at, updated_at
       ) VALUES ($1, $2, $3, 1, 'razorpay', $4, $5, 'INR', 'CAPTURED', NOW(), NOW())`,
      [attemptId, paymentId, storeId, `pay_${paymentId.slice(0, 10)}`, paymentAmount],
    );

    return {
      storeId,
      orderId,
      checkoutId,
      paymentId,
      variantId,
      reservationId,
    };
  }

  it("executes full end-to-end cancellation: transitions order, releases reservation, and refunds payment", async () => {
    const db = await setupDb();
    const fixture = await seedFullCommerceAggregate(db, {
      initialStock: 20,
      reserveQuantity: 3,
      paymentAmount: 6000,
    });

    const releaseService = new ReservationReleaseService();
    const refundService = new OrderCancellationRefundService();
    const coordinator = new OrderCancellationCoordinator(
      undefined,
      undefined,
      releaseService,
      refundService,
    );

    const result = await coordinator.cancelOrder(db, {
      storeId: fixture.storeId,
      orderId: fixture.orderId,
      reason: "Customer changed mind",
      actorType: "MERCHANT",
    });

    // 1. Order transitioned to CANCELLED
    expect(result.order.status).toBe("CANCELLED");
    expect(result.cancellationStatus).toBe("CANCELLED");

    // 2. Inventory released and stock restored
    expect(result.inventory.released).toBe(true);
    expect(result.inventory.releasedCount).toBe(1);

    const invService = new InventoryService();
    const item = await invService.getInventoryItem(db, fixture.storeId, fixture.variantId);
    expect(item.availableQuantity).toBe(20);
    expect(item.reservedQuantity).toBe(0);

    const reservation = await invService.getReservation(db, fixture.storeId, fixture.reservationId);
    expect(reservation.status).toBe("RELEASED");

    // 3. Payment refunded and order payment status updated to REFUNDED
    expect(result.refund.status).toBe("SUCCEEDED");
    expect(result.refund.amount).toBe(6000);

    const paymentRepo = new PaymentRepository();
    const payment = await paymentRepo.findById(db, fixture.storeId, fixture.paymentId);
    expect(payment?.status).toBe("REFUNDED");
    expect(Number(payment?.refunded_amount)).toBe(6000);

    const orderRes = await db.query<{ payment_status: string }>(
      `SELECT payment_status FROM orders WHERE id = $1 AND store_id = $2`,
      [fixture.orderId, fixture.storeId],
    );
    expect(orderRes.rows[0]?.payment_status).toBe("REFUNDED");
  });

  it("recovers interrupted cancellation via OrderCancellationRecoveryJob", async () => {
    const db = await setupDb();
    const fixture = await seedFullCommerceAggregate(db, {
      initialStock: 15,
      reserveQuantity: 2,
      paymentAmount: 4500,
    });

    // Simulate an interrupted cancellation: order was set to CANCELLED in database,
    // but the process crashed before releasing inventory or initiating refund.
    await db.query(
      `UPDATE orders SET status = 'CANCELLED', cancelled_at = NOW() WHERE id = $1 AND store_id = $2`,
      [fixture.orderId, fixture.storeId],
    );

    // Verify initial dirty state: reservation still ACTIVE, payment still unrefunded
    const invService = new InventoryService();
    const initialRes = await invService.getReservation(db, fixture.storeId, fixture.reservationId);
    expect(initialRes.status).toBe("ACTIVE");

    // Execute OrderCancellationRecoveryJob
    const recoveryJob = new OrderCancellationRecoveryJob();
    const summary = await recoveryJob.run(db, { batchSize: 50 });

    expect(summary.success).toBe(true);
    expect(summary.inventoryReservationsRecovered).toBeGreaterThanOrEqual(1);
    expect(summary.refundsRecovered).toBeGreaterThanOrEqual(1);

    // Verify inventory restored
    const finalItem = await invService.getInventoryItem(db, fixture.storeId, fixture.variantId);
    expect(finalItem.availableQuantity).toBe(15);
    expect(finalItem.reservedQuantity).toBe(0);

    const finalRes = await invService.getReservation(db, fixture.storeId, fixture.reservationId);
    expect(finalRes.status).toBe("RELEASED");

    // Verify refund succeeded
    const paymentRepo = new PaymentRepository();
    const finalPayment = await paymentRepo.findById(db, fixture.storeId, fixture.paymentId);
    expect(finalPayment?.status).toBe("REFUNDED");
    expect(Number(finalPayment?.refunded_amount)).toBe(4500);

    // Running recovery a second time is a complete no-op (idempotent)
    const secondSummary = await recoveryJob.run(db, { batchSize: 50 });
    expect(secondSummary.inventoryReservationsRecovered).toBe(0);
    expect(secondSummary.refundsRecovered).toBe(0);
  });

  it("handles concurrent recovery execution safely without double side-effects", async () => {
    const db = await setupDb();
    const fixture = await seedFullCommerceAggregate(db, {
      initialStock: 10,
      reserveQuantity: 2,
      paymentAmount: 3000,
    });

    // Simulate interrupted cancellation
    await db.query(
      `UPDATE orders SET status = 'CANCELLED', cancelled_at = NOW() WHERE id = $1 AND store_id = $2`,
      [fixture.orderId, fixture.storeId],
    );

    const job1 = new OrderCancellationRecoveryJob();
    const job2 = new OrderCancellationRecoveryJob();

    // Race two recovery jobs simultaneously
    const [summary1, summary2] = await Promise.all([
      job1.run(db, { batchSize: 50 }),
      job2.run(db, { batchSize: 50 }),
    ]);

    const totalInvRecovered =
      summary1.inventoryReservationsRecovered + summary2.inventoryReservationsRecovered;
    const totalRefundsRecovered =
      summary1.refundsRecovered + summary2.refundsRecovered;

    // Both together should have restored reservation exactly once
    expect(totalInvRecovered).toBe(1);
    expect(totalRefundsRecovered).toBe(1);

    // Stock must be restored exactly once (10 available, 0 reserved)
    const invService = new InventoryService();
    const finalItem = await invService.getInventoryItem(db, fixture.storeId, fixture.variantId);
    expect(finalItem.availableQuantity).toBe(10);
    expect(finalItem.reservedQuantity).toBe(0);

    // Exactly one refund record created
    const refundRepo = new RefundRepository();
    const refunds = await refundRepo.findByPaymentId(db, fixture.storeId, fixture.paymentId);
    expect(refunds).toHaveLength(1);
    expect(refunds[0]!.status).toBe("SUCCEEDED");
  });
});
