import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import {
  PaymentRecoveryJob,
} from "../../apps/worker/src/jobs/payments/payment-recovery-job.js";
import {
  RazorpayPaymentProvider,
  RazorpayClient,
  type HttpTransport,
} from "@calcart/payments";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("PaymentRecoveryJob Unit and Integration Tests", { timeout: 35_000 }, () => {
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
    slug = "job-rcv-store",
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
    price = 6000,
  ): Promise<{ productId: string; variantId: string }> {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Canvas Backpack', $3, 'ACTIVE')`,
      [productId, storeId, `backpack-${Date.now().toString(36)}-${Math.random()}`],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Navy Blue', 'BP-NVY', $4, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId, price],
    );

    return { productId, variantId };
  }

  async function seedCheckoutWithItem(
    db: Database,
    storeId: string,
    variantId: string,
    price = 6000,
  ): Promise<string> {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );

    const checkoutId = generateUuidV7();
    const address = JSON.stringify({
      firstName: "David",
      lastName: "Miller",
      addressLine1: "789 Mission St",
      city: "San Francisco",
      state: "CA",
      postalCode: "94103",
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
       ) VALUES ($1, $2, $3, $4, 'Canvas Backpack', 'Navy Blue', 'BP-NVY', $5, 1, $5)`,
      [generateUuidV7(), checkoutId, storeId, variantId, price],
    );

    return checkoutId;
  }

  it("recovers an orphaned captured payment awaiting order creation", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "job-orphan-recovery");
    const { variantId } = await seedProductAndVariant(db, storeId, 6000);
    const checkoutId = await seedCheckoutWithItem(db, storeId, variantId, 6000);

    const paymentId = generateUuidV7();
    const attemptId = generateUuidV7();

    // Persist payment that succeeded at provider and was marked CAPTURED,
    // but the worker or server crashed before order creation was completed.
    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, amount, currency, status,
         provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, 6000, 'USD', 'CAPTURED', 'razorpay', 6000, 0)`,
      [paymentId, storeId, checkoutId],
    );

    await db.query(
      `INSERT INTO payment_attempts (
         id, payment_id, store_id, attempt_number, provider, amount, currency,
         status, provider_payment_id, provider_order_id
       ) VALUES ($1, $2, $3, 1, 'razorpay', 6000, 'USD', 'CAPTURED', 'pay_rec_test', 'order_rec_test')`,
      [attemptId, paymentId, storeId],
    );

    const job = new PaymentRecoveryJob();
    const result = await job.run(db, { batchSize: 10 });

    expect(result.success).toBe(true);
    expect(result.orphanedCaptured.recovered).toBe(1);
    expect(result.orphanedCaptured.failed).toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // Verify order was created and checkout completed
    const ordersRes = await db.query<{ id: string; status: string; payment_status: string }>(
      `SELECT id, status, payment_status FROM orders WHERE checkout_id = $1`,
      [checkoutId],
    );
    expect(ordersRes.rows.length).toBe(1);
    expect(ordersRes.rows[0]?.status).toBe("PENDING");
    expect(ordersRes.rows[0]?.payment_status).toBe("PAID");

    const checkoutRes = await db.query<{ status: string }>(
      `SELECT status FROM checkouts WHERE id = $1`,
      [checkoutId],
    );
    expect(checkoutRes.rows[0]?.status).toBe("COMPLETED");

    const paymentRes = await db.query<{ order_id: string }>(
      `SELECT order_id FROM payments WHERE id = $1`,
      [paymentId],
    );
    expect(paymentRes.rows[0]?.order_id).toBe(ordersRes.rows[0]?.id);
  });

  it("skips already completed workflows idempotently on subsequent runs", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "job-idempotent");
    const { variantId } = await seedProductAndVariant(db, storeId, 5000);
    const checkoutId = await seedCheckoutWithItem(db, storeId, variantId, 5000);

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
       ) VALUES ($1, $2, $3, 1, 'razorpay', 5000, 'USD', 'CAPTURED', 'pay_rec_idemp', 'order_rec_idemp')`,
      [attemptId, paymentId, storeId],
    );

    const job = new PaymentRecoveryJob();

    // First run recovers work
    const firstResult = await job.run(db, { batchSize: 10 });
    expect(firstResult.orphanedCaptured.recovered).toBe(1);

    // Second run has nothing to recover
    const secondResult = await job.run(db, { batchSize: 10 });
    expect(secondResult.success).toBe(true);
    expect(secondResult.orphanedCaptured.recovered).toBe(0);
    expect(secondResult.totalProcessed).toBe(0);

    // Invariant: still exactly 1 order row
    const ordersRes = await db.query(`SELECT count(*)::int as count FROM orders WHERE checkout_id = $1`, [
      checkoutId,
    ]);
    expect(ordersRes.rows[0]?.count).toBe(1);
  });

  it("handles transient failure gracefully without throwing unhandled exceptions", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "job-transient-failure");

    // Seed empty checkout with no items (causes OrderService to fail during recovery)
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );

    const emptyCheckoutId = generateUuidV7();
    await db.query(
      `INSERT INTO checkouts (
         id, store_id, cart_id, total, subtotal, discount_total, tax_total, shipping_total,
         status, payment_status, currency
       ) VALUES ($1, $2, $3, 4000, 4000, 0, 0, 0, 'PAYMENT_PENDING', 'PENDING', 'USD')`,
      [emptyCheckoutId, storeId, cartId],
    );

    const paymentId = generateUuidV7();
    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, amount, currency, status,
         provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, 4000, 'USD', 'CAPTURED', 'razorpay', 4000, 0)`,
      [paymentId, storeId, emptyCheckoutId],
    );

    const job = new PaymentRecoveryJob();
    const result = await job.run(db, { batchSize: 10 });

    expect(result.job).toBe("payment-recovery");
    expect(result.orphanedCaptured.failed).toBe(1);
    expect(result.orphanedCaptured.recovered).toBe(0);
    expect(result.success).toBe(false);
  });

  it("reconciles ambiguous payments using configured provider", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "job-reconcile-provider");
    const { variantId } = await seedProductAndVariant(db, storeId, 8000);
    const checkoutId = await seedCheckoutWithItem(db, storeId, variantId, 8000);

    const paymentId = generateUuidV7();
    const attemptId = generateUuidV7();
    const providerPaymentId = "pay_rzp_rec_job_001";

    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, amount, currency, status,
         provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, 8000, 'USD', 'REQUIRES_RECONCILIATION', 'razorpay', 0, 0)`,
      [paymentId, storeId, checkoutId],
    );

    await db.query(
      `INSERT INTO payment_attempts (
         id, payment_id, store_id, attempt_number, provider, amount, currency,
         status, provider_payment_id, provider_order_id
       ) VALUES ($1, $2, $3, 1, 'razorpay', 8000, 'USD', 'REQUIRES_RECONCILIATION', $4, 'order_rec_job_001')`,
      [attemptId, paymentId, storeId, providerPaymentId],
    );

    // Mock Razorpay provider reporting captured payment
    const transport: HttpTransport = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes(`/payments/${providerPaymentId}`)) {
        return new Response(
          JSON.stringify({
            id: providerPaymentId,
            entity: "payment",
            amount: 8000,
            currency: "USD",
            status: "captured",
            order_id: "order_rec_job_001",
            captured: true,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    };

    const client = new RazorpayClient({
      keyId: "rzp_test_jobKey",
      keySecret: "rzp_test_jobSecret",
      transport,
    });
    const provider = new RazorpayPaymentProvider({
      keyId: "rzp_test_jobKey",
      keySecret: "rzp_test_jobSecret",
      client,
    });

    const job = new PaymentRecoveryJob(undefined, provider);
    const result = await job.run(db, { batchSize: 10 });

    expect(result.success).toBe(true);
    expect(result.ambiguousReconciled.reconciled).toBe(1);

    // Payment transitioned to CAPTURED and order created
    const pmt = await db.query<{ status: string; order_id: string }>(
      `SELECT status, order_id FROM payments WHERE id = $1`,
      [paymentId],
    );
    expect(pmt.rows[0]?.status).toBe("CAPTURED");
    expect(pmt.rows[0]?.order_id).toBeDefined();

    const order = await db.query<{ id: string; payment_status: string }>(
      `SELECT id, payment_status FROM orders WHERE checkout_id = $1`,
      [checkoutId],
    );
    expect(order.rows[0]?.payment_status).toBe("PAID");
  });

  it("respects batch size limits", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "job-batch-limit");
    const { variantId } = await seedProductAndVariant(db, storeId, 3000);

    // Seed 4 orphaned payments
    for (let i = 0; i < 4; i++) {
      const checkoutId = await seedCheckoutWithItem(db, storeId, variantId, 3000);
      const paymentId = generateUuidV7();
      await db.query(
        `INSERT INTO payments (
           id, store_id, checkout_id, amount, currency, status,
           provider, captured_amount, refunded_amount
         ) VALUES ($1, $2, $3, 3000, 'USD', 'CAPTURED', 'razorpay', 3000, 0)`,
        [paymentId, storeId, checkoutId],
      );
      await db.query(
        `INSERT INTO payment_attempts (
           id, payment_id, store_id, attempt_number, provider, amount, currency,
           status, provider_payment_id, provider_order_id
         ) VALUES ($1, $2, $3, 1, 'razorpay', 3000, 'USD', 'CAPTURED', $4, 'order_batch')`,
        [generateUuidV7(), paymentId, storeId, `pay_batch_${i}`],
      );
    }

    const job = new PaymentRecoveryJob();

    // Run with batchSize: 2
    const firstBatch = await job.run(db, { batchSize: 2 });
    expect(firstBatch.orphanedCaptured.recovered).toBe(2);

    // Run next batch
    const secondBatch = await job.run(db, { batchSize: 2 });
    expect(secondBatch.orphanedCaptured.recovered).toBe(2);

    // Remaining should now be 0
    const thirdBatch = await job.run(db, { batchSize: 2 });
    expect(thirdBatch.orphanedCaptured.recovered).toBe(0);
  });
});
