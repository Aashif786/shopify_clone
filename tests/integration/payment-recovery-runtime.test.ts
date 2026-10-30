import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { startWorker, type WorkerInstance } from "../../apps/worker/src/index.js";
import { PaymentRecoveryScheduler } from "../../apps/worker/src/schedulers/payment-recovery-scheduler.js";
import { PaymentRecoveryJob } from "../../apps/worker/src/jobs/payments/payment-recovery-job.js";
import { WebhookRecoveryJob } from "../../apps/worker/src/jobs/payments/webhook-recovery-job.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Payment Recovery Runtime and Scheduler Integration", { timeout: 35_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let activeWorker: WorkerInstance | null = null;

  afterEach(async () => {
    if (activeWorker) {
      await activeWorker.stop().catch(() => {});
      activeWorker = null;
    }
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
    slug = "runtime-store",
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
    price = 5500,
  ): Promise<{ productId: string; variantId: string }> {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Leather Cardholder', $3, 'ACTIVE')`,
      [productId, storeId, `cardholder-${Date.now().toString(36)}-${Math.random()}`],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Tan', 'CRD-TAN', $4, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId, price],
    );

    return { productId, variantId };
  }

  async function seedCheckoutWithItem(
    db: Database,
    storeId: string,
    variantId: string,
    price = 5500,
  ): Promise<string> {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );

    const checkoutId = generateUuidV7();
    const address = JSON.stringify({
      firstName: "Michael",
      lastName: "Scott",
      addressLine1: "1725 Slough Ave",
      city: "Scranton",
      state: "PA",
      postalCode: "18503",
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
       ) VALUES ($1, $2, $3, $4, 'Leather Cardholder', 'Tan', 'CRD-TAN', $5, 1, $5)`,
      [generateUuidV7(), checkoutId, storeId, variantId, price],
    );

    return checkoutId;
  }

  it("starts worker runtime, registers recovery jobs, and executes recovery cycle", async () => {
    const db = await setupDb();
    activeWorker = await startWorker({ database: db });

    expect(activeWorker).toBeDefined();
    expect(activeWorker.scheduler).toBeDefined();

    const status = activeWorker.scheduler.getStatus();
    expect(status.active).toBe(true);
    expect(status.stopping).toBe(false);

    // Trigger cycle explicitly
    const result = await activeWorker.scheduler.runNow();

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.paymentRecovery).toBeDefined();
    expect(result.paymentRecovery.job).toBe("payment-recovery");
    expect(result.webhookRecovery).toBeDefined();
    expect(result.webhookRecovery.job).toBe("webhook-recovery");

    // Stop worker cleanly
    await activeWorker.stop();
    const afterStopStatus = activeWorker.scheduler.getStatus();
    expect(afterStopStatus.active).toBe(false);
    expect(afterStopStatus.stopping).toBe(true);
  });

  it("prevents overlapping execution within the same process", async () => {
    const db = await setupDb();

    // Create a slow payment job mock
    let resolveSlowJob: (() => void) | undefined;
    const slowPaymentJob = {
      run: async () => {
        await new Promise<void>((resolve) => {
          resolveSlowJob = resolve;
        });
        return {
          job: "payment-recovery" as const,
          orphanedCaptured: { recovered: 0, failed: 0 },
          ambiguousReconciled: { reconciled: 0, failed: 0 },
          totalProcessed: 0,
          durationMs: 50,
          success: true,
        };
      },
    } as unknown as PaymentRecoveryJob;

    const fastWebhookJob = {
      run: async () => ({
        job: "webhook-recovery" as const,
        recoveredCount: 0,
        failedCount: 0,
        totalProcessed: 0,
        durationMs: 1,
        success: true,
        events: [],
      }),
    } as unknown as WebhookRecoveryJob;

    const scheduler = new PaymentRecoveryScheduler(
      db,
      { enabled: true, pollIntervalMs: 10_000, batchSize: 50, leaseTimeoutMs: 60_000 },
      slowPaymentJob,
      fastWebhookJob,
    );

    // Launch first tick in-flight
    const firstTickPromise = scheduler.tick();

    // While first tick is in flight, launch second tick
    const secondTickResult = await scheduler.tick();

    // Overlapping tick was skipped and returned null
    expect(secondTickResult).toBeNull();

    // Release first tick
    if (resolveSlowJob) {
      resolveSlowJob();
    }
    const firstTickResult = await firstTickPromise;
    expect(firstTickResult).not.toBeNull();
    expect(firstTickResult?.paymentRecovery.success).toBe(true);

    await scheduler.stop();
  });

  it("recovers orphaned payments and webhooks automatically across end-to-end runtime cycle", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "runtime-cycle-store");
    const { variantId } = await seedProductAndVariant(db, storeId, 5500);
    const checkoutId = await seedCheckoutWithItem(db, storeId, variantId, 5500);

    // 1. Seed an orphaned captured payment
    const paymentId = generateUuidV7();
    const attemptId = generateUuidV7();
    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, amount, currency, status,
         provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, 5500, 'USD', 'CAPTURED', 'razorpay', 5500, 0)`,
      [paymentId, storeId, checkoutId],
    );
    await db.query(
      `INSERT INTO payment_attempts (
         id, payment_id, store_id, attempt_number, provider, amount, currency,
         status, provider_payment_id, provider_order_id
       ) VALUES ($1, $2, $3, 1, 'razorpay', 5500, 'USD', 'CAPTURED', 'pay_rnt_1', 'order_rnt_1')`,
      [attemptId, paymentId, storeId],
    );

    // 2. Start worker and trigger cycle
    activeWorker = await startWorker({ database: db });
    const runResult = await activeWorker.scheduler.runNow();

    expect(runResult.paymentRecovery.orphanedCaptured.recovered).toBe(1);
    expect(runResult.paymentRecovery.success).toBe(true);

    // Invariant: Order is created, payment is linked, checkout is completed
    const order = await db.query<{ id: string; payment_status: string }>(
      `SELECT id, payment_status FROM orders WHERE checkout_id = $1`,
      [checkoutId],
    );
    expect(order.rows.length).toBe(1);
    expect(order.rows[0]?.payment_status).toBe("PAID");

    const pmt = await db.query<{ order_id: string }>(`SELECT order_id FROM payments WHERE id = $1`, [
      paymentId,
    ]);
    expect(pmt.rows[0]?.order_id).toBe(order.rows[0]?.id);

    const chk = await db.query<{ status: string }>(`SELECT status FROM checkouts WHERE id = $1`, [
      checkoutId,
    ]);
    expect(chk.rows[0]?.status).toBe("COMPLETED");

    await activeWorker.stop();
  });

  it("handles shutdown cleanly by awaiting in-flight executions and rejecting new ticks", async () => {
    const db = await setupDb();
    const scheduler = new PaymentRecoveryScheduler(
      db,
      { enabled: true, pollIntervalMs: 5000, batchSize: 50, leaseTimeoutMs: 60_000 },
    );

    scheduler.start();
    expect(scheduler.getStatus().active).toBe(true);

    await scheduler.stop();
    expect(scheduler.getStatus().active).toBe(false);
    expect(scheduler.getStatus().stopping).toBe(true);

    // Subsequent tick after stop returns null
    const result = await scheduler.tick();
    expect(result).toBeNull();
  });
});
