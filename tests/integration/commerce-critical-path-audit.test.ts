import { afterEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@shopify-clone/db";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import {
  RefundService,
  OrderCancellationRefundService,
  PaymentNotRefundableError,
  CrossStorePaymentAccessError,
} from "../../modules/payments/src/index.js";
import {
  OrderCancellationCoordinator,
  OrderCancellationRecoveryService,
  CrossStoreOrderAccessError,
} from "../../modules/orders/src/index.js";
import { ReservationReleaseService } from "../../modules/inventory/src/index.js";

describe("Commerce Critical-Path Integrity Audit Integration Tests", { timeout: 30_000 }, () => {
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

  async function seedStore(db: Database, name: string): Promise<string> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`, [
      orgId,
      `Org ${name}`,
    ]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, name, `slug-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`],
    );
    return storeId;
  }

  async function seedOrderAndPayment(
    db: Database,
    storeId: string,
    options: {
      orderStatus?: string;
      paymentStatus?: string;
      capturedAmount?: number;
      refundedAmount?: number;
      orderPaymentStatus?: string;
    } = {},
  ): Promise<{ orderId: string; paymentId: string; checkoutId: string }> {
    const orderId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const paymentId = generateUuidV7();
    const customerId = generateUuidV7();
    const cartId = generateUuidV7();

    const orderStatus = options.orderStatus ?? "CONFIRMED";
    const paymentStatus = options.paymentStatus ?? "CAPTURED";
    const capturedAmount = options.capturedAmount ?? 5000;
    const refundedAmount = options.refundedAmount ?? 0;
    const orderPaymentStatus = options.orderPaymentStatus ?? "PAID";

    // Seed customer
    await db.query(
      `INSERT INTO customers (id, store_id, email, first_name, last_name)
       VALUES ($1, $2, 'cust@example.com', 'Test', 'Customer')`,
      [customerId, storeId],
    );

    // Seed cart
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );

    // Seed checkout
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, customer_id, status, currency, total)
       VALUES ($1, $2, $3, $4, 'COMPLETED', 'USD', 5000)`,
      [checkoutId, storeId, cartId, customerId],
    );

    // Seed order
    await db.query(
      `INSERT INTO orders (
         id, store_id, customer_id, checkout_id, order_number, status, payment_status,
         fulfillment_status, currency, subtotal, discount_total, shipping_total,
         tax_total, grand_total, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'UNFULFILLED', 'USD', 5000, 0, 0, 0, 5000, NOW(), NOW())`,
      [orderId, storeId, customerId, checkoutId, `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, orderStatus, orderPaymentStatus],
    );

    // Seed payment
    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, order_id, amount, currency, status, provider,
         captured_amount, refunded_amount, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 5000, 'USD', $5, 'razorpay', $6, $7, NOW(), NOW())`,
      [paymentId, storeId, checkoutId, orderId, paymentStatus, capturedAmount, refundedAmount],
    );

    // Seed payment attempt
    const attemptId = generateUuidV7();
    await db.query(
      `INSERT INTO payment_attempts (
         id, payment_id, store_id, attempt_number, amount, currency, status, provider, provider_payment_id
       ) VALUES ($1, $2, $3, 1, 5000, 'USD', 'CAPTURED', 'razorpay', $4)`,
      [attemptId, paymentId, storeId, `pay_${paymentId.slice(0, 14)}`],
    );

    return { orderId, paymentId, checkoutId };
  }

  it("P1-A Regression: RefundService rejects refund when payment has no order linkage instead of fabricating fake order UUID", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db, "Store Unlinked Payment");
    const cartId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const paymentId = generateUuidV7();

    await db.query(`INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`, [
      cartId,
      storeId,
    ]);
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, 10000, 'PAYMENT_PENDING', 'PENDING', 'USD')`,
      [checkoutId, storeId, cartId],
    );

    // Payment captured during checkout, but order creation hasn't occurred yet (order_id IS NULL)
    await db.query(
      `INSERT INTO payments (id, store_id, checkout_id, order_id, amount, currency, status, provider, captured_amount, refunded_amount)
       VALUES ($1, $2, $3, NULL, 10000, 'USD', 'CAPTURED', 'razorpay', 10000, 0)`,
      [paymentId, storeId, checkoutId],
    );

    const refundService = new RefundService();

    // Calling requestRefund without orderId must reject with PaymentNotRefundableError
    // rather than generating a random UUID and failing with PostgreSQL foreign key constraint violation
    await expect(
      refundService.requestRefund(db, {
        storeId,
        paymentId,
        amount: 5000,
        idempotencyKey: "test-refund-no-order",
      }),
    ).rejects.toThrow(PaymentNotRefundableError);

    // Verify no orphaned refund rows were created
    const refunds = await db.query(`SELECT * FROM refunds WHERE payment_id = $1`, [paymentId]);
    expect(refunds.rows).toHaveLength(0);
  });

  it("P1-A Feature: RefundService accepts caller-provided orderId for unlinked payment, links order, and completes refund", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db, "Store Order Linked");
    const cartId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const paymentId = generateUuidV7();
    const orderId = generateUuidV7();

    await db.query(`INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`, [
      cartId,
      storeId,
    ]);
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, 10000, 'COMPLETED', 'PAID', 'USD')`,
      [checkoutId, storeId, cartId],
    );
    await db.query(
      `INSERT INTO orders (id, store_id, checkout_id, order_number, total, grand_total, currency, status, payment_status)
       VALUES ($1, $2, $3, 'ORD-AUDIT-1', 10000, 10000, 'USD', 'CONFIRMED', 'PAID')`,
      [orderId, storeId, checkoutId],
    );

    // Payment has order_id = NULL initially
    await db.query(
      `INSERT INTO payments (id, store_id, checkout_id, order_id, amount, currency, status, provider, captured_amount, refunded_amount)
       VALUES ($1, $2, $3, NULL, 10000, 'USD', 'CAPTURED', 'razorpay', 10000, 0)`,
      [paymentId, storeId, checkoutId],
    );

    const refundService = new RefundService();
    const refundDTO = await refundService.requestRefund(db, {
      storeId,
      paymentId,
      orderId,
      amount: 4000,
      reason: "Partial return",
      idempotencyKey: "test-refund-with-order",
    });

    expect(refundDTO.orderId).toBe(orderId);
    expect(refundDTO.amount).toBe(4000);
    expect(refundDTO.status).toBe("PENDING");

    // Verify payment record in database now has order_id linked
    const paymentRow = await db.query<{ order_id: string }>(
      `SELECT order_id FROM payments WHERE id = $1`,
      [paymentId],
    );
    expect(paymentRow.rows[0]?.order_id).toBe(orderId);

    // Verify refund record references valid order foreign key
    const refundRow = await db.query<{ order_id: string; amount: string }>(
      `SELECT order_id, amount FROM refunds WHERE id = $1`,
      [refundDTO.id],
    );
    expect(refundRow.rows[0]?.order_id).toBe(orderId);
    expect(Number(refundRow.rows[0]?.amount)).toBe(4000);
  });

  it("P1-B Regression: OrderCancellationRecoveryService recovers cancelled orders with PARTIALLY_REFUNDED payments having remaining balance", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db, "Store Partial Refund Recovery");

    // Seed order in CANCELLED and payment in PARTIALLY_REFUNDED (captured 5000, refunded 2000 -> 3000 remaining)
    const { orderId, paymentId } = await seedOrderAndPayment(db, storeId, {
      orderStatus: "CANCELLED",
      paymentStatus: "PARTIALLY_REFUNDED",
      capturedAmount: 5000,
      refundedAmount: 2000,
      orderPaymentStatus: "PARTIALLY_REFUNDED",
    });

    const refundService = new OrderCancellationRefundService();
    const recoveryService = new OrderCancellationRecoveryService(undefined, refundService);

    const summary = await recoveryService.recoverPendingCancellations(db, { batchSize: 10 });
    expect(summary.refundsRecovered).toBe(1);
    expect(summary.refundsFailed).toBe(0);
    expect(summary.success).toBe(true);

    // Verify the payment is now fully refunded (5000 refunded of 5000 captured)
    const updatedPayment = await db.query<{ status: string; refunded_amount: string }>(
      `SELECT status, refunded_amount FROM payments WHERE id = $1`,
      [paymentId],
    );
    expect(updatedPayment.rows[0]?.status).toBe("REFUNDED");
    expect(Number(updatedPayment.rows[0]?.refunded_amount)).toBe(5000);

    // Verify order payment status transitioned to REFUNDED
    const updatedOrder = await db.query<{ payment_status: string }>(
      `SELECT payment_status FROM orders WHERE id = $1`,
      [orderId],
    );
    expect(updatedOrder.rows[0]?.payment_status).toBe("REFUNDED");
  });

  it("Tenant Isolation: Prevents cross-tenant order cancellation and payment refunds", async () => {
    const db = await setupDb();
    const storeA = await seedStore(db, "Store Alpha");
    const storeB = await seedStore(db, "Store Beta");

    const { orderId, paymentId } = await seedOrderAndPayment(db, storeA, {
      orderStatus: "CONFIRMED",
      paymentStatus: "CAPTURED",
      capturedAmount: 5000,
    });

    const coordinator = new OrderCancellationCoordinator(
      undefined,
      undefined,
      new ReservationReleaseService(),
      new OrderCancellationRefundService(),
    );

    // Attempting to cancel Store A's order from Store B's context must be rejected
    await expect(
      coordinator.cancelOrder(db, {
        storeId: storeB,
        orderId,
        reason: "Malicious cross-tenant attempt",
      }),
    ).rejects.toThrow(CrossStoreOrderAccessError);

    // Attempting to refund Store A's payment from Store B's context must be rejected
    const refundService = new RefundService();
    await expect(
      refundService.requestRefund(db, {
        storeId: storeB,
        paymentId,
        orderId,
        amount: 2500,
        idempotencyKey: "cross-tenant-refund",
      }),
    ).rejects.toThrow(CrossStorePaymentAccessError);
  });

  it("Idempotent Retries: Duplicate refund requests with identical key return existing record safely without double refunding", async () => {
    const db = await setupDb();
    const storeId = await seedStore(db, "Store Idempotent Refund");
    const { orderId, paymentId } = await seedOrderAndPayment(db, storeId, {
      orderStatus: "CONFIRMED",
      paymentStatus: "CAPTURED",
      capturedAmount: 5000,
    });

    const refundService = new RefundService();
    const key = `idem-refund-${orderId}`;

    const refund1 = await refundService.requestRefund(db, {
      storeId,
      paymentId,
      orderId,
      amount: 2000,
      reason: "Return",
      idempotencyKey: key,
    });

    const refund2 = await refundService.requestRefund(db, {
      storeId,
      paymentId,
      orderId,
      amount: 2000,
      reason: "Return",
      idempotencyKey: key,
    });

    expect(refund1.id).toBe(refund2.id);
    expect(refund1.amount).toBe(refund2.amount);

    // Verify only ONE refund record exists in database
    const refundRows = await db.query(
      `SELECT count(*) FROM refunds WHERE store_id = $1 AND idempotency_key = $2`,
      [storeId, key],
    );
    expect(Number(refundRows.rows[0]?.count)).toBe(1);
  });
});
