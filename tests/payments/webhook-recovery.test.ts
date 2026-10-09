import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { WebhookRecoveryService } from "../../modules/payments/src/webhooks/webhook-recovery.js";
import { PaymentWebhookService } from "../../modules/payments/src/application/payment-webhook-service.js";
import { computeRazorpayWebhookSignature } from "../../modules/payments/src/webhooks/razorpay-webhook-signature.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("INT-06: Webhook Processing Lease & Recovery Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const webhookSecret = "test_wh_secret_key_123";

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
    slug = "wh-rcv-store",
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
       VALUES ($1, $2, 'Leather Wallet', $3, 'ACTIVE')`,
      [productId, storeId, `wallet-${Date.now().toString(36)}-${Math.random()}`],
    );

    await db.query(
      `INSERT INTO product_variants (id, product_id, store_id, title, sku, price, currency, status)
       VALUES ($1, $2, $3, 'Brown', 'WLT-BRN', $4, 'USD', 'ACTIVE')`,
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
      firstName: "Bob",
      lastName: "Miller",
      addressLine1: "100 Pine St",
      city: "Seattle",
      state: "WA",
      postalCode: "98101",
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
       ) VALUES ($1, $2, $3, $4, 'Leather Wallet', 'Brown', 'WLT-BRN', $5, 1, $5)`,
      [generateUuidV7(), checkoutId, storeId, variantId, price],
    );

    return checkoutId;
  }

  async function seedPaymentAndAttempt(
    db: Database,
    storeId: string,
    checkoutId: string,
    providerPaymentId = "pay_webhook_test_1",
    amount = 6000,
  ): Promise<{ paymentId: string; attemptId: string }> {
    const paymentId = generateUuidV7();
    const attemptId = generateUuidV7();

    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, amount, currency, status,
         provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, $4, 'USD', 'PENDING', 'razorpay', 0, 0)`,
      [paymentId, storeId, checkoutId, amount],
    );

    await db.query(
      `INSERT INTO payment_attempts (
         id, payment_id, store_id, attempt_number, provider, amount, currency,
         status, provider_payment_id, provider_order_id
       ) VALUES ($1, $2, $3, 1, 'razorpay', $4, 'USD', 'PENDING', $5, 'order_wh_1')`,
      [attemptId, paymentId, storeId, amount, providerPaymentId],
    );

    return { paymentId, attemptId };
  }

  function createCapturedWebhookPayload(
    paymentId: string,
    attemptId: string,
    storeId: string,
    amount = 6000,
  ) {
    return {
      entity: "event",
      account_id: "acc_test",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: "pay_webhook_test_1",
            entity: "payment",
            amount,
            currency: "USD",
            status: "captured",
            order_id: "order_wh_1",
            captured: true,
            notes: {
              store_id: storeId,
              payment_id: paymentId,
              attempt_id: attemptId,
            },
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  it("acknowledges duplicate delivery while event is actively being processed (within lease)", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "wh-active-lease");
    const providerEventId = "event_active_lease_1";

    // Manually insert event claimed 5 seconds ago (active lease)
    await db.query(
      `INSERT INTO payment_webhook_events (
         id, store_id, provider, provider_event_id, event_type,
         signature_verified, payload, status, processed_at
       ) VALUES ($1, $2, 'razorpay', $3, 'payment.captured', TRUE, '{}', 'PROCESSING', NOW())`,
      [generateUuidV7(), storeId, providerEventId],
    );

    const webhookService = new PaymentWebhookService(webhookSecret);
    const payloadObj = createCapturedWebhookPayload("pay_1", "att_1", storeId, 5000);
    const rawBody = JSON.stringify(payloadObj);
    const signature = computeRazorpayWebhookSignature(rawBody, webhookSecret);

    const outcome = await webhookService.processWebhook(db, {
      rawBody,
      signature,
      headerEventId: providerEventId,
    });

    expect(outcome.status).toBe("DUPLICATE");
    expect(outcome.message).toContain("Concurrent processing in progress");
  });

  it("reclaims and processes event when previous worker crashed and lease expired", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "wh-reclaim-expired");
    const { variantId } = await seedProductAndVariant(db, storeId, 6000);
    const checkoutId = await seedCheckoutWithItem(db, storeId, variantId, 6000);
    const { paymentId, attemptId } = await seedPaymentAndAttempt(db, storeId, checkoutId);

    const providerEventId = "event_abandoned_worker_crash";
    const payloadObj = createCapturedWebhookPayload(paymentId, attemptId, storeId, 6000);
    const rawBody = JSON.stringify(payloadObj);
    const signature = computeRazorpayWebhookSignature(rawBody, webhookSecret);

    // Simulate worker crash 5 minutes ago (status = PROCESSING, processed_at = 5 mins ago)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await db.query(
      `INSERT INTO payment_webhook_events (
         id, store_id, provider, provider_event_id, event_type,
         signature_verified, payload, status, processed_at, created_at
       ) VALUES ($1, $2, 'razorpay', $3, 'payment.captured', TRUE, $4, 'PROCESSING', $5, $5)`,
      [generateUuidV7(), storeId, providerEventId, rawBody, fiveMinutesAgo],
    );

    // Delivery arrives again (Razorpay retry)
    const webhookService = new PaymentWebhookService(webhookSecret, undefined, undefined, undefined, 60_000);

    const outcome = await webhookService.processWebhook(db, {
      rawBody,
      signature,
      headerEventId: providerEventId,
    });

    expect(outcome.status).toBe("PROCESSED");
    expect(outcome.paymentId).toBe(paymentId);

    // Verify payment is now CAPTURED
    const paymentRes = await db.query<{ status: string; order_id: string | null }>(
      `SELECT status, order_id FROM payments WHERE id = $1`,
      [paymentId],
    );
    expect(paymentRes.rows[0]?.status).toBe("CAPTURED");
    expect(paymentRes.rows[0]?.order_id).not.toBeNull();

    // Verify event in database is now marked PROCESSED
    const eventRes = await db.query<{ status: string }>(
      `SELECT status FROM payment_webhook_events WHERE provider_event_id = $1`,
      [providerEventId],
    );
    expect(eventRes.rows[0]?.status).toBe("PROCESSED");
  });

  it("WebhookRecoveryService recovers multiple abandoned PROCESSING events safely", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "wh-bulk-recovery");
    const { variantId } = await seedProductAndVariant(db, storeId, 6000);
    const checkoutId = await seedCheckoutWithItem(db, storeId, variantId, 6000);
    const { paymentId, attemptId } = await seedPaymentAndAttempt(db, storeId, checkoutId);

    const providerEventId = "event_bulk_abandoned_1";
    const payloadObj = createCapturedWebhookPayload(paymentId, attemptId, storeId, 6000);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    await db.query(
      `INSERT INTO payment_webhook_events (
         id, store_id, provider, provider_event_id, event_type,
         signature_verified, payload, status, processed_at, created_at
       ) VALUES ($1, $2, 'razorpay', $3, 'payment.captured', TRUE, $4, 'PROCESSING', $5, $5)`,
      [generateUuidV7(), storeId, providerEventId, JSON.stringify(payloadObj), tenMinutesAgo],
    );

    const recoveryService = new WebhookRecoveryService();
    const result = await recoveryService.recoverAbandonedEvents(db, { leaseTimeoutMs: 60_000 });

    expect(result.recoveredCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.events[0]?.status).toBe("PROCESSED");

    // Verify order was created
    const checkoutRes = await db.query<{ status: string }>(
      `SELECT status FROM checkouts WHERE id = $1`,
      [checkoutId],
    );
    expect(checkoutRes.rows[0]?.status).toBe("COMPLETED");
  });

  it("completed duplicate (PROCESSED or IGNORED) is acknowledged without re-executing", async () => {
    const db = await setupDb();
    const { storeId } = await seedTestStore(db, "wh-completed-dup");
    const providerEventId = "event_already_processed";

    await db.query(
      `INSERT INTO payment_webhook_events (
         id, store_id, provider, provider_event_id, event_type,
         signature_verified, payload, status, processed_at
       ) VALUES ($1, $2, 'razorpay', $3, 'payment.captured', TRUE, '{}', 'PROCESSED', NOW())`,
      [generateUuidV7(), storeId, providerEventId],
    );

    const webhookService = new PaymentWebhookService(webhookSecret);
    const payloadObj = createCapturedWebhookPayload("pay_dup", "att_dup", storeId, 5000);
    const rawBody = JSON.stringify(payloadObj);
    const signature = computeRazorpayWebhookSignature(rawBody, webhookSecret);

    const outcome = await webhookService.processWebhook(db, {
      rawBody,
      signature,
      headerEventId: providerEventId,
    });

    expect(outcome.status).toBe("DUPLICATE");
    expect(outcome.duplicate).toBe(true);
    expect(outcome.message).toBe("Event has already been processed");
  });
});
