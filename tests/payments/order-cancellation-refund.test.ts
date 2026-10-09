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
  OrderCancellationRefundService,
  PaymentProvider,
  RazorpayTimeoutError,
} from "../../modules/payments/src/index.js";

describe("OrderCancellationRefundService Integration Tests", { timeout: 30_000 }, () => {
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
    slug = "store-refund-coord",
  ): Promise<{ orgId: string; storeId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${slug}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'INR', 'en-IN', 'Asia/Kolkata')`,
      [storeId, orgId, `Store ${slug}`, `${slug}-${Date.now()}`],
    );
    return { orgId, storeId };
  }

  async function seedOrderAndPayment(
    db: Database,
    storeId: string,
    options: {
      paymentStatus?: string;
      capturedAmount?: number;
      refundedAmount?: number;
      orderPaymentStatus?: string;
    } = {},
  ): Promise<{ orderId: string; paymentId: string; attemptId: string }> {
    const orderId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const paymentId = generateUuidV7();
    const attemptId = generateUuidV7();
    const customerId = generateUuidV7();

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
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );

    // Seed checkout
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, customer_id, status, currency, total)
       VALUES ($1, $2, $3, $4, 'COMPLETED', 'INR', 5000)`,
      [checkoutId, storeId, cartId, customerId],
    );

    // Seed order
    await db.query(
      `INSERT INTO orders (
         id, store_id, customer_id, checkout_id, order_number, status, payment_status,
         fulfillment_status, currency, subtotal, discount_total, shipping_total,
         tax_total, grand_total, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'CANCELLED', $6, 'CANCELLED', 'INR', 5000, 0, 0, 0, 5000, NOW(), NOW())`,
      [orderId, storeId, customerId, checkoutId, `ORD-${Date.now()}`, orderPaymentStatus],
    );

    // Seed payment
    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, order_id, amount, currency, status, provider,
         captured_amount, refunded_amount, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 5000, 'INR', $5, 'razorpay', $6, $7, NOW(), NOW())`,
      [paymentId, storeId, checkoutId, orderId, paymentStatus, capturedAmount, refundedAmount],
    );

    // Seed payment attempt
    const attemptStatus =
      paymentStatus === "REFUNDED" || paymentStatus === "PARTIALLY_REFUNDED"
        ? "CAPTURED"
        : paymentStatus;

    await db.query(
      `INSERT INTO payment_attempts (
         id, payment_id, store_id, attempt_number, provider, provider_payment_id,
         amount, currency, status, created_at, updated_at
       ) VALUES ($1, $2, $3, 1, 'razorpay', $4, 5000, 'INR', $5, NOW(), NOW())`,
      [attemptId, paymentId, storeId, `pay_test_${paymentId.slice(0, 8)}`, attemptStatus],
    );

    return { orderId, paymentId, attemptId };
  }

  it("initiates and succeeds refund for captured order payment, updating order payment status to REFUNDED", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { orderId, paymentId } = await seedOrderAndPayment(db, storeId, {
      paymentStatus: "CAPTURED",
      capturedAmount: 5000,
      refundedAmount: 0,
      orderPaymentStatus: "PAID",
    });

    const refundService = new OrderCancellationRefundService();

    const result = await refundService.processCancellationRefund(db, {
      storeId,
      orderId,
      reason: "Customer requested cancellation",
    });

    expect(result.status).toBe("SUCCEEDED");
    expect(result.amount).toBe(5000);
    expect(result.refundId).toBeDefined();

    // Verify payment updated
    const paymentRepo = new PaymentRepository();
    const payment = await paymentRepo.findById(db, storeId, paymentId);
    expect(payment?.status).toBe("REFUNDED");
    expect(Number(payment?.refunded_amount)).toBe(5000);

    // Verify order payment status updated to REFUNDED
    const orderRes = await db.query<{ payment_status: string }>(
      `SELECT payment_status FROM orders WHERE id = $1 AND store_id = $2`,
      [orderId, storeId],
    );
    expect(orderRes.rows[0]?.payment_status).toBe("REFUNDED");
  });

  it("ensures repeated cancellation refund calls are idempotent without duplicate refunds", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { orderId, paymentId } = await seedOrderAndPayment(db, storeId, {
      paymentStatus: "CAPTURED",
      capturedAmount: 5000,
      refundedAmount: 0,
    });

    const refundService = new OrderCancellationRefundService();

    const res1 = await refundService.processCancellationRefund(db, {
      storeId,
      orderId,
    });
    expect(res1.status).toBe("SUCCEEDED");

    const res2 = await refundService.processCancellationRefund(db, {
      storeId,
      orderId,
    });
    expect(res2.status).toBe("SUCCEEDED");
    expect(res2.refundId).toBe(res1.refundId);

    // Verify only ONE refund record exists
    const refundRepo = new RefundRepository();
    const refunds = await refundRepo.findByPaymentId(db, storeId, paymentId);
    expect(refunds).toHaveLength(1);
  });

  it("does not refund payments that were not captured", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { orderId } = await seedOrderAndPayment(db, storeId, {
      paymentStatus: "PENDING",
      capturedAmount: 0,
      refundedAmount: 0,
      orderPaymentStatus: "PENDING",
    });

    const refundService = new OrderCancellationRefundService();

    const result = await refundService.processCancellationRefund(db, {
      storeId,
      orderId,
    });

    expect(result.status).toBe("NOT_APPLICABLE");
    expect(result.reason).toContain("not captured");

    // Verify no refunds created
    const countRes = await db.query<{ count: string }>(
      `SELECT count(*) FROM refunds WHERE store_id = $1`,
      [storeId],
    );
    expect(Number(countRes.rows[0]?.count)).toBe(0);
  });

  it("does not refund already fully refunded payment", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { orderId } = await seedOrderAndPayment(db, storeId, {
      paymentStatus: "REFUNDED",
      capturedAmount: 5000,
      refundedAmount: 5000,
      orderPaymentStatus: "REFUNDED",
    });

    const refundService = new OrderCancellationRefundService();

    const result = await refundService.processCancellationRefund(db, {
      storeId,
      orderId,
    });

    expect(result.status).toBe("NOT_APPLICABLE");
    expect(result.reason).toContain("already fully refunded");
  });

  it("handles provider gateway timeout by recording REQUIRES_RECONCILIATION without failing cancellation", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);
    const { orderId } = await seedOrderAndPayment(db, storeId);

    const timingOutProvider: PaymentProvider = {
      name: "razorpay",
      createOrder: async () => { throw new Error("not implemented"); },
      getPayment: async () => { throw new Error("not implemented"); },
      verifyPaymentSignature: () => true,
      createRefund: async () => {
        throw new RazorpayTimeoutError("Gateway timeout during refund creation");
      },
    };

    const refundService = new OrderCancellationRefundService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      timingOutProvider,
    );

    const result = await refundService.processCancellationRefund(db, {
      storeId,
      orderId,
    });

    expect(result.status).toBe("REQUIRES_RECONCILIATION");
    expect(result.refundId).toBeDefined();

    // Verify refund row status in database is REQUIRES_RECONCILIATION
    const refundRepo = new RefundRepository();
    const refundRow = await refundRepo.findById(db, storeId, result.refundId!);
    expect(refundRow?.status).toBe("REQUIRES_RECONCILIATION");
  });

  it("returns NOT_APPLICABLE when order has no associated payment", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db);

    const refundService = new OrderCancellationRefundService();

    const result = await refundService.processCancellationRefund(db, {
      storeId,
      orderId: generateUuidV7(),
    });

    expect(result.status).toBe("NOT_APPLICABLE");
    expect(result.reason).toContain("No payment associated with order");
  });
});
