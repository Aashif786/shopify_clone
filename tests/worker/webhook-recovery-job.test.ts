import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { WebhookRecoveryJob } from "../../apps/worker/src/jobs/payments/webhook-recovery-job.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("WebhookRecoveryJob Unit and Integration Tests", { timeout: 35_000 }, () => {
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
    slug = "wh-job-store",
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
    price = 6500,
  ): Promise<{ productId: string; variantId: string }> {
    const productId = generateUuidV7();
    const variantId = generateUuidV7();

    await db.query(
      `INSERT INTO products (id, store_id, title, slug, status)
       VALUES ($1, $2, 'Denim Jacket', $3, 'ACTIVE')`,
      [productId, storeId, `jacket-${Date.now().toString(36)}-${Math.random()}`],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Medium Blue', 'JKT-BLU-M', $4, 'USD', 'ACTIVE')`,
      [variantId, productId, storeId, price],
    );

    return { productId, variantId };
  }

  async function seedCheckoutWithItem(
    db: Database,
    storeId: string,
    variantId: string,
    price = 6500,
  ): Promise<string> {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );

    const checkoutId = generateUuidV7();
    const address = JSON.stringify({
      firstName: "Sarah",
      lastName: "Connor",
      addressLine1: "100 Broadway",
      city: "New York",
      state: "NY",
      postalCode: "10001",
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
       ) VALUES ($1, $2, $3, $4, 'Denim Jacket', 'Medium Blue', 'JKT-BLU-M', $5, 1, $5)`,
      [generateUuidV7(), checkoutId, storeId, variantId, price],
    );

    return checkoutId;
  }

  function createCapturedPayload(
    paymentId: string,
    attemptId: string,
    storeId: string,
    amount = 6500,
  ) {
    return {
      entity: "event",
      account_id: "acc_wh_job",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: `pay_prov_${Date.now().toString(36)}`,
            entity: "payment",
            amount,
            currency: "USD",
            status: "captured",
            order_id: "order_wh_prov_1",
            captured: true,
            notes: {
              store_id: storeId,
              payment_id: paymentId,
              attempt_id: attemptId,
            },
          },
        },
      },
    };
  }

  it("reclaims abandoned PROCESSING events past lease timeout and finalizes purchase", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "wh-job-reclaim");
    const { variantId } = await seedProductAndVariant(db, storeId, 6500);
    const checkoutId = await seedCheckoutWithItem(db, storeId, variantId, 6500);

    const paymentId = generateUuidV7();
    const attemptId = generateUuidV7();

    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, amount, currency, status,
         provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, 6500, 'USD', 'PENDING', 'razorpay', 0, 0)`,
      [paymentId, storeId, checkoutId],
    );

    await db.query(
      `INSERT INTO payment_attempts (
         id, payment_id, store_id, attempt_number, provider, amount, currency,
         status, provider_payment_id, provider_order_id
       ) VALUES ($1, $2, $3, 1, 'razorpay', 6500, 'USD', 'PENDING', 'pay_wh_orig', 'order_wh_prov_1')`,
      [attemptId, paymentId, storeId],
    );

    // Insert event abandoned in PROCESSING 3 minutes ago (expired lease)
    const eventId = generateUuidV7();
    const providerEventId = "evt_abandoned_job_1";
    const payload = createCapturedPayload(paymentId, attemptId, storeId, 6500);

    await db.query(
      `INSERT INTO payment_webhook_events (
         id, store_id, provider, provider_event_id, event_type,
         signature_verified, payload, status, processed_at
       ) VALUES ($1, $2, 'razorpay', $3, 'payment.captured', TRUE, $4, 'PROCESSING', NOW() - INTERVAL '3 minutes')`,
      [eventId, storeId, providerEventId, JSON.stringify(payload)],
    );

    const job = new WebhookRecoveryJob();
    const result = await job.run(db, { leaseTimeoutMs: 60_000, batchSize: 10 });

    expect(result.job).toBe("webhook-recovery");
    expect(result.recoveredCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.success).toBe(true);

    // Event marked PROCESSED
    const eventRow = await db.query<{ status: string }>(
      `SELECT status FROM payment_webhook_events WHERE id = $1`,
      [eventId],
    );
    expect(eventRow.rows[0]?.status).toBe("PROCESSED");

    // Payment marked CAPTURED and order created
    const pmt = await db.query<{ status: string; order_id: string }>(
      `SELECT status, order_id FROM payments WHERE id = $1`,
      [paymentId],
    );
    expect(pmt.rows[0]?.status).toBe("CAPTURED");
    expect(pmt.rows[0]?.order_id).toBeDefined();

    const chk = await db.query<{ status: string }>(
      `SELECT status FROM checkouts WHERE id = $1`,
      [checkoutId],
    );
    expect(chk.rows[0]?.status).toBe("COMPLETED");

    const ordersRes = await db.query<{ id: string; payment_status: string }>(
      `SELECT id, payment_status FROM orders WHERE checkout_id = $1`,
      [checkoutId],
    );
    expect(ordersRes.rows.length).toBe(1);
    expect(ordersRes.rows[0]?.payment_status).toBe("PAID");
  });

  it("does not reprocess already completed events (PROCESSED or IGNORED)", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "wh-job-completed-skip");

    const eventId = generateUuidV7();
    await db.query(
      `INSERT INTO payment_webhook_events (
         id, store_id, provider, provider_event_id, event_type,
         signature_verified, payload, status, processed_at
       ) VALUES ($1, $2, 'razorpay', 'evt_already_completed', 'payment.captured', TRUE, '{}', 'PROCESSED', NOW() - INTERVAL '10 minutes')`,
      [eventId, storeId],
    );

    const job = new WebhookRecoveryJob();
    const result = await job.run(db, { leaseTimeoutMs: 60_000 });

    expect(result.totalProcessed).toBe(0);
    expect(result.recoveredCount).toBe(0);
    expect(result.success).toBe(true);
  });

  it("respects active leases and does not reclaim events within lease window", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "wh-job-active-lease");

    const eventId = generateUuidV7();
    // Claimed 10 seconds ago (active lease, timeout is 60s)
    await db.query(
      `INSERT INTO payment_webhook_events (
         id, store_id, provider, provider_event_id, event_type,
         signature_verified, payload, status, processed_at
       ) VALUES ($1, $2, 'razorpay', 'evt_actively_running', 'payment.captured', TRUE, '{}', 'PROCESSING', NOW() - INTERVAL '10 seconds')`,
      [eventId, storeId],
    );

    const job = new WebhookRecoveryJob();
    const result = await job.run(db, { leaseTimeoutMs: 60_000 });

    expect(result.totalProcessed).toBe(0);
    expect(result.recoveredCount).toBe(0);
  });

  it("handles concurrent recovery attempts safely without duplicate business effects", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "wh-job-race");
    const { variantId } = await seedProductAndVariant(db, storeId, 4500);
    const checkoutId = await seedCheckoutWithItem(db, storeId, variantId, 4500);

    const paymentId = generateUuidV7();
    const attemptId = generateUuidV7();

    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, amount, currency, status,
         provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, 4500, 'USD', 'PENDING', 'razorpay', 0, 0)`,
      [paymentId, storeId, checkoutId],
    );

    await db.query(
      `INSERT INTO payment_attempts (
         id, payment_id, store_id, attempt_number, provider, amount, currency,
         status, provider_payment_id, provider_order_id
       ) VALUES ($1, $2, $3, 1, 'razorpay', 4500, 'USD', 'PENDING', 'pay_race_1', 'order_race_1')`,
      [attemptId, paymentId, storeId],
    );

    const eventId = generateUuidV7();
    const payload = createCapturedPayload(paymentId, attemptId, storeId, 4500);

    await db.query(
      `INSERT INTO payment_webhook_events (
         id, store_id, provider, provider_event_id, event_type,
         signature_verified, payload, status, processed_at
       ) VALUES ($1, $2, 'razorpay', 'evt_race_candidate', 'payment.captured', TRUE, $3, 'PROCESSING', NOW() - INTERVAL '5 minutes')`,
      [eventId, storeId, JSON.stringify(payload)],
    );

    const job1 = new WebhookRecoveryJob();
    const job2 = new WebhookRecoveryJob();

    // Race both jobs concurrently
    const [res1, res2] = await Promise.all([
      job1.run(db, { leaseTimeoutMs: 60_000 }),
      job2.run(db, { leaseTimeoutMs: 60_000 }),
    ]);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);

    // Across both runs, exactly 1 recovery succeeded (other worker skips or finds 0)
    expect(res1.recoveredCount + res2.recoveredCount).toBe(1);

    // Invariant: exactly 1 order exists
    const orderRows = await db.query(`SELECT count(*)::int as count FROM orders WHERE checkout_id = $1`, [
      checkoutId,
    ]);
    expect(orderRows.rows[0]?.count).toBe(1);
  });

  it("records processing failures visibly and allows retry", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "wh-job-failure");

    const eventId = generateUuidV7();
    // Payload referencing non-existent payment attempt (throws WebhookEntityNotFoundError)
    const malformedPayload = {
      entity: "event",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_ghost_unknown_1",
            amount: 5000,
            currency: "USD",
          },
        },
      },
    };

    await db.query(
      `INSERT INTO payment_webhook_events (
         id, store_id, provider, provider_event_id, event_type,
         signature_verified, payload, status, processed_at
       ) VALUES ($1, $2, 'razorpay', 'evt_malformed_rec', 'payment.captured', TRUE, $3, 'PROCESSING', NOW() - INTERVAL '5 minutes')`,
      [eventId, storeId, JSON.stringify(malformedPayload)],
    );

    const job = new WebhookRecoveryJob();
    const result = await job.run(db, { leaseTimeoutMs: 60_000 });

    expect(result.failedCount).toBe(1);
    expect(result.recoveredCount).toBe(0);
    expect(result.success).toBe(false);
  });
});
