import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { createHmac } from "node:crypto";
import { PaymentService } from "../../modules/payments/src/application/payment-service.js";
import { PaymentWebhookService } from "../../modules/payments/src/application/payment-webhook-service.js";
import {
  WebhookEntityNotFoundError,
  WebhookPayloadValidationError,
  WebhookSignatureVerificationError,
} from "../../modules/payments/src/webhooks/webhook-errors.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Payment Webhook Processor & Service Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const paymentService = new PaymentService();
  const testWebhookSecret = "whsec_test_secret_proc_123456789";

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
    slug = "wh-proc-store",
    currency = "USD",
  ): Promise<{ orgId: string; storeId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${slug}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5, 'en-US', 'America/New_York')`,
      [storeId, orgId, `Store ${slug}`, slug, currency],
    );
    return { orgId, storeId };
  }

  async function seedTestCart(db: Database, storeId: string): Promise<string> {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );
    return cartId;
  }

  async function seedTestCheckout(
    db: Database,
    storeId: string,
    cartId: string,
    total = 5000,
    status = "OPEN",
    currency = "USD",
  ): Promise<string> {
    const checkoutId = generateUuidV7();
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)`,
      [checkoutId, storeId, cartId, total, status, currency],
    );
    return checkoutId;
  }

  function signPayload(body: string, secret = testWebhookSecret): string {
    return createHmac("sha256", secret).update(body).digest("hex");
  }

  describe("1. Supported Payment Events", () => {
    it("processes payment.captured event and updates payment and attempt to CAPTURED", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "wh-captured");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 6000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const providerOrderId = "order_RZP_CAPTURED_1";
      await db.query(
        `UPDATE payment_attempts SET provider_order_id = $1, status = 'PENDING' WHERE id = $2`,
        [providerOrderId, localPayment.attempt.id],
      );

      const webhookService = new PaymentWebhookService(testWebhookSecret);
      const rawPayload = JSON.stringify({
        id: "evt_captured_123",
        entity: "event",
        event: "payment.captured",
        contains: ["payment"],
        payload: {
          payment: {
            entity: {
              id: "pay_RZP_CAPTURED_1",
              entity: "payment",
              amount: 6000,
              currency: "USD",
              status: "captured",
              order_id: providerOrderId,
              method: "card",
              captured: true,
            },
          },
        },
        created_at: 1700000000,
      });

      const outcome = await webhookService.processWebhook(db, {
        rawBody: rawPayload,
        signature: signPayload(rawPayload),
        headerEventId: "evt_captured_123",
      });

      expect(outcome.status).toBe("PROCESSED");
      expect(outcome.paymentId).toBe(localPayment.payment.id);
      expect(outcome.attemptId).toBe(localPayment.attempt.id);

      // Verify payment row
      const pmtQuery = await db.query<{ status: string; captured_amount: string }>(
        `SELECT status, captured_amount FROM payments WHERE id = $1`,
        [localPayment.payment.id],
      );
      expect(pmtQuery.rows[0]?.status).toBe("CAPTURED");
      expect(Number(pmtQuery.rows[0]?.captured_amount)).toBe(6000);

      // Verify attempt row
      const attQuery = await db.query<{ status: string; provider_payment_id: string }>(
        `SELECT status, provider_payment_id FROM payment_attempts WHERE id = $1`,
        [localPayment.attempt.id],
      );
      expect(attQuery.rows[0]?.status).toBe("CAPTURED");
      expect(attQuery.rows[0]?.provider_payment_id).toBe("pay_RZP_CAPTURED_1");

      // Verify payment_webhook_events row
      const evtQuery = await db.query<{ status: string; signature_verified: boolean }>(
        `SELECT status, signature_verified FROM payment_webhook_events WHERE provider_event_id = $1`,
        ["evt_captured_123"],
      );
      expect(evtQuery.rows[0]?.status).toBe("PROCESSED");
      expect(evtQuery.rows[0]?.signature_verified).toBe(true);
    });

    it("processes payment.authorized event and updates payment and attempt to AUTHORIZED", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "wh-authorized");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 4500, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const providerOrderId = "order_RZP_AUTH_1";
      await db.query(
        `UPDATE payment_attempts SET provider_order_id = $1, status = 'PENDING' WHERE id = $2`,
        [providerOrderId, localPayment.attempt.id],
      );

      const webhookService = new PaymentWebhookService(testWebhookSecret);
      const rawPayload = JSON.stringify({
        id: "evt_auth_456",
        entity: "event",
        event: "payment.authorized",
        contains: ["payment"],
        payload: {
          payment: {
            entity: {
              id: "pay_RZP_AUTH_1",
              entity: "payment",
              amount: 4500,
              currency: "USD",
              status: "authorized",
              order_id: providerOrderId,
              method: "upi",
              captured: false,
            },
          },
        },
        created_at: 1700000000,
      });

      const outcome = await webhookService.processWebhook(db, {
        rawBody: rawPayload,
        signature: signPayload(rawPayload),
        headerEventId: "evt_auth_456",
      });

      expect(outcome.status).toBe("PROCESSED");

      const pmtQuery = await db.query<{ status: string }>(
        `SELECT status FROM payments WHERE id = $1`,
        [localPayment.payment.id],
      );
      expect(pmtQuery.rows[0]?.status).toBe("AUTHORIZED");

      const attQuery = await db.query<{ status: string }>(
        `SELECT status FROM payment_attempts WHERE id = $1`,
        [localPayment.attempt.id],
      );
      expect(attQuery.rows[0]?.status).toBe("AUTHORIZED");
    });

    it("processes payment.failed event and updates payment and attempt to FAILED with error details", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "wh-failed");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 3000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const providerOrderId = "order_RZP_FAIL_1";
      await db.query(
        `UPDATE payment_attempts SET provider_order_id = $1, status = 'PENDING' WHERE id = $2`,
        [providerOrderId, localPayment.attempt.id],
      );

      const webhookService = new PaymentWebhookService(testWebhookSecret);
      const rawPayload = JSON.stringify({
        id: "evt_failed_789",
        entity: "event",
        event: "payment.failed",
        contains: ["payment"],
        payload: {
          payment: {
            entity: {
              id: "pay_RZP_FAIL_1",
              entity: "payment",
              amount: 3000,
              currency: "USD",
              status: "failed",
              order_id: providerOrderId,
              method: "card",
              captured: false,
              error_code: "BAD_REQUEST_ERROR",
              error_description: "Insufficient funds in customer account",
            },
          },
        },
        created_at: 1700000000,
      });

      const outcome = await webhookService.processWebhook(db, {
        rawBody: rawPayload,
        signature: signPayload(rawPayload),
        headerEventId: "evt_failed_789",
      });

      expect(outcome.status).toBe("PROCESSED");

      const pmtQuery = await db.query<{ status: string }>(
        `SELECT status FROM payments WHERE id = $1`,
        [localPayment.payment.id],
      );
      expect(pmtQuery.rows[0]?.status).toBe("FAILED");

      const attQuery = await db.query<{ status: string; failure_code: string; failure_message: string }>(
        `SELECT status, failure_code, failure_message FROM payment_attempts WHERE id = $1`,
        [localPayment.attempt.id],
      );
      expect(attQuery.rows[0]?.status).toBe("FAILED");
      expect(attQuery.rows[0]?.failure_code).toBe("BAD_REQUEST_ERROR");
      expect(attQuery.rows[0]?.failure_message).toBe("Insufficient funds in customer account");
    });
  });

  describe("2. Unsupported Events and Malformed Payloads", () => {
    it("safely marks unsupported event as IGNORED without mutating payment", async () => {
      const db = await setupDb();
      const webhookService = new PaymentWebhookService(testWebhookSecret);

      const rawPayload = JSON.stringify({
        id: "evt_unsupported_1",
        entity: "event",
        event: "subscription.activated",
        contains: ["subscription"],
        payload: { subscription: { id: "sub_123" } },
        created_at: 1700000000,
      });

      const outcome = await webhookService.processWebhook(db, {
        rawBody: rawPayload,
        signature: signPayload(rawPayload),
        headerEventId: "evt_unsupported_1",
      });

      expect(outcome.status).toBe("IGNORED");

      const evtQuery = await db.query<{ status: string }>(
        `SELECT status FROM payment_webhook_events WHERE provider_event_id = $1`,
        ["evt_unsupported_1"],
      );
      expect(evtQuery.rows[0]?.status).toBe("IGNORED");
    });

    it("rejects malformed JSON payload with WebhookPayloadValidationError", async () => {
      const db = await setupDb();
      const webhookService = new PaymentWebhookService(testWebhookSecret);
      const invalidJson = "{ this is not json }";

      await expect(
        webhookService.processWebhook(db, {
          rawBody: invalidJson,
          signature: signPayload(invalidJson),
        }),
      ).rejects.toThrow(WebhookPayloadValidationError);
    });

    it("rejects payload missing event name with WebhookPayloadValidationError", async () => {
      const db = await setupDb();
      const webhookService = new PaymentWebhookService(testWebhookSecret);
      const badPayload = JSON.stringify({ entity: "event" });

      await expect(
        webhookService.processWebhook(db, {
          rawBody: badPayload,
          signature: signPayload(badPayload),
        }),
      ).rejects.toThrow(WebhookPayloadValidationError);
    });

    it("throws WebhookSignatureVerificationError on invalid signature and does not persist event", async () => {
      const db = await setupDb();
      const webhookService = new PaymentWebhookService(testWebhookSecret);
      const rawPayload = JSON.stringify({ entity: "event", event: "payment.captured" });

      await expect(
        webhookService.processWebhook(db, {
          rawBody: rawPayload,
          signature: "tampered_signature_hex",
        }),
      ).rejects.toThrow(WebhookSignatureVerificationError);

      const count = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM payment_webhook_events`,
      );
      expect(Number(count.rows[0]?.count)).toBe(0); // Zero poison in deduplication table
    });
  });

  describe("3. Unknown Entity & Amount/Currency Invariant Violations", () => {
    it("throws WebhookEntityNotFoundError if no local attempt or payment exists", async () => {
      const db = await setupDb();
      const webhookService = new PaymentWebhookService(testWebhookSecret);

      const rawPayload = JSON.stringify({
        id: "evt_unknown_1",
        entity: "event",
        event: "payment.captured",
        contains: ["payment"],
        payload: {
          payment: {
            entity: {
              id: "pay_unknown_999",
              amount: 5000,
              currency: "USD",
              status: "captured",
              order_id: "order_unknown_999",
            },
          },
        },
        created_at: 1700000000,
      });

      await expect(
        webhookService.processWebhook(db, {
          rawBody: rawPayload,
          signature: signPayload(rawPayload),
          headerEventId: "evt_unknown_1",
        }),
      ).rejects.toThrow(WebhookEntityNotFoundError);

      // Event is recorded as FAILED for retryability
      const evtQuery = await db.query<{ status: string; error_message: string }>(
        `SELECT status, error_message FROM payment_webhook_events WHERE provider_event_id = $1`,
        ["evt_unknown_1"],
      );
      expect(evtQuery.rows[0]?.status).toBe("FAILED");
      expect(evtQuery.rows[0]?.error_message).toContain("No local payment attempt found");
    });

    it("transitions payment to REQUIRES_RECONCILIATION on amount mismatch", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "wh-amt-mismatch");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const providerOrderId = "order_RZP_MM_1";
      await db.query(
        `UPDATE payment_attempts SET provider_order_id = $1, status = 'PENDING' WHERE id = $2`,
        [providerOrderId, localPayment.attempt.id],
      );

      const webhookService = new PaymentWebhookService(testWebhookSecret);
      const rawPayload = JSON.stringify({
        id: "evt_mm_amt",
        entity: "event",
        event: "payment.captured",
        contains: ["payment"],
        payload: {
          payment: {
            entity: {
              id: "pay_MM_1",
              amount: 2500, // MISMATCH: 2500 vs 5000
              currency: "USD",
              status: "captured",
              order_id: providerOrderId,
            },
          },
        },
        created_at: 1700000000,
      });

      const outcome = await webhookService.processWebhook(db, {
        rawBody: rawPayload,
        signature: signPayload(rawPayload),
        headerEventId: "evt_mm_amt",
      });

      expect(outcome.status).toBe("RECONCILIATION_REQUIRED");
      expect(outcome.requiresReconciliation).toBe(true);

      const pmtQuery = await db.query<{ status: string }>(
        `SELECT status FROM payments WHERE id = $1`,
        [localPayment.payment.id],
      );
      expect(pmtQuery.rows[0]?.status).toBe("REQUIRES_RECONCILIATION");
    });

    it("transitions payment to REQUIRES_RECONCILIATION on currency mismatch", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "wh-curr-mismatch");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const providerOrderId = "order_RZP_CURR_1";
      await db.query(
        `UPDATE payment_attempts SET provider_order_id = $1, status = 'PENDING' WHERE id = $2`,
        [providerOrderId, localPayment.attempt.id],
      );

      const webhookService = new PaymentWebhookService(testWebhookSecret);
      const rawPayload = JSON.stringify({
        id: "evt_mm_curr",
        entity: "event",
        event: "payment.captured",
        contains: ["payment"],
        payload: {
          payment: {
            entity: {
              id: "pay_CURR_1",
              amount: 5000,
              currency: "INR", // MISMATCH: INR vs USD
              status: "captured",
              order_id: providerOrderId,
            },
          },
        },
        created_at: 1700000000,
      });

      const outcome = await webhookService.processWebhook(db, {
        rawBody: rawPayload,
        signature: signPayload(rawPayload),
        headerEventId: "evt_mm_curr",
      });

      expect(outcome.status).toBe("RECONCILIATION_REQUIRED");

      const pmtQuery = await db.query<{ status: string }>(
        `SELECT status FROM payments WHERE id = $1`,
        [localPayment.payment.id],
      );
      expect(pmtQuery.rows[0]?.status).toBe("REQUIRES_RECONCILIATION");
    });
  });

  describe("4. Deduplication & Concurrency Protection", () => {
    it("handles duplicate delivery idempotently without producing duplicate financial effects", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "wh-dedup");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 7000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const providerOrderId = "order_RZP_DEDUP_1";
      await db.query(
        `UPDATE payment_attempts SET provider_order_id = $1, status = 'PENDING' WHERE id = $2`,
        [providerOrderId, localPayment.attempt.id],
      );

      const webhookService = new PaymentWebhookService(testWebhookSecret);
      const rawPayload = JSON.stringify({
        id: "evt_dedup_unique_1",
        entity: "event",
        event: "payment.captured",
        contains: ["payment"],
        payload: {
          payment: {
            entity: {
              id: "pay_DEDUP_1",
              amount: 7000,
              currency: "USD",
              status: "captured",
              order_id: providerOrderId,
            },
          },
        },
        created_at: 1700000000,
      });

      const firstOutcome = await webhookService.processWebhook(db, {
        rawBody: rawPayload,
        signature: signPayload(rawPayload),
        headerEventId: "evt_dedup_unique_1",
      });
      expect(firstOutcome.status).toBe("PROCESSED");

      // Second delivery: identical payload & event ID
      const secondOutcome = await webhookService.processWebhook(db, {
        rawBody: rawPayload,
        signature: signPayload(rawPayload),
        headerEventId: "evt_dedup_unique_1",
      });
      expect(secondOutcome.status).toBe("DUPLICATE");
      expect(secondOutcome.duplicate).toBe(true);

      // Verify captured_amount remains exactly 7000, not doubled
      const pmtQuery = await db.query<{ captured_amount: string }>(
        `SELECT captured_amount FROM payments WHERE id = $1`,
        [localPayment.payment.id],
      );
      expect(Number(pmtQuery.rows[0]?.captured_amount)).toBe(7000);
    });

    it("handles concurrent duplicate deliveries safely", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "wh-concurrent");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 8000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const providerOrderId = "order_RZP_CONCURRENT_1";
      await db.query(
        `UPDATE payment_attempts SET provider_order_id = $1, status = 'PENDING' WHERE id = $2`,
        [providerOrderId, localPayment.attempt.id],
      );

      const webhookService = new PaymentWebhookService(testWebhookSecret);
      const rawPayload = JSON.stringify({
        id: "evt_concurrent_99",
        entity: "event",
        event: "payment.captured",
        contains: ["payment"],
        payload: {
          payment: {
            entity: {
              id: "pay_CONCURRENT_1",
              amount: 8000,
              currency: "USD",
              status: "captured",
              order_id: providerOrderId,
            },
          },
        },
        created_at: 1700000000,
      });

      // Fire 2 concurrent deliveries
      const [res1, res2] = await Promise.all([
        webhookService.processWebhook(db, {
          rawBody: rawPayload,
          signature: signPayload(rawPayload),
          headerEventId: "evt_concurrent_99",
        }),
        webhookService.processWebhook(db, {
          rawBody: rawPayload,
          signature: signPayload(rawPayload),
          headerEventId: "evt_concurrent_99",
        }),
      ]);

      const outcomes = [res1.status, res2.status];
      expect(outcomes).toContain("PROCESSED");
      // The other outcome is DUPLICATE
      expect(outcomes).toContain("DUPLICATE");
    });
  });

  describe("5. Stale and Out-of-Order Events", () => {
    it("never regresses an already CAPTURED payment when a late payment.failed arrives", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "wh-stale-fail");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const providerOrderId = "order_RZP_STALE_1";
      await db.query(
        `UPDATE payments SET status = 'CAPTURED', captured_amount = 5000 WHERE id = $1`,
        [localPayment.payment.id],
      );
      await db.query(
        `UPDATE payment_attempts SET provider_order_id = $1, status = 'CAPTURED' WHERE id = $2`,
        [providerOrderId, localPayment.attempt.id],
      );

      const webhookService = new PaymentWebhookService(testWebhookSecret);
      const rawPayload = JSON.stringify({
        id: "evt_stale_failed_1",
        entity: "event",
        event: "payment.failed",
        contains: ["payment"],
        payload: {
          payment: {
            entity: {
              id: "pay_STALE_1",
              amount: 5000,
              currency: "USD",
              status: "failed",
              order_id: providerOrderId,
              error_code: "GATEWAY_TIMEOUT",
            },
          },
        },
        created_at: 1700000000,
      });

      const outcome = await webhookService.processWebhook(db, {
        rawBody: rawPayload,
        signature: signPayload(rawPayload),
        headerEventId: "evt_stale_failed_1",
      });

      expect(outcome.status).toBe("IGNORED");

      // Verify payment was NOT regressed to FAILED
      const pmtQuery = await db.query<{ status: string }>(
        `SELECT status FROM payments WHERE id = $1`,
        [localPayment.payment.id],
      );
      expect(pmtQuery.rows[0]?.status).toBe("CAPTURED");
    });

    it("ignores out-of-order payment.authorized when payment is already CAPTURED", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "wh-stale-auth");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const providerOrderId = "order_RZP_STALE_2";
      await db.query(
        `UPDATE payments SET status = 'CAPTURED', captured_amount = 5000 WHERE id = $1`,
        [localPayment.payment.id],
      );
      await db.query(
        `UPDATE payment_attempts SET provider_order_id = $1, status = 'CAPTURED' WHERE id = $2`,
        [providerOrderId, localPayment.attempt.id],
      );

      const webhookService = new PaymentWebhookService(testWebhookSecret);
      const rawPayload = JSON.stringify({
        id: "evt_stale_auth_2",
        entity: "event",
        event: "payment.authorized",
        contains: ["payment"],
        payload: {
          payment: {
            entity: {
              id: "pay_STALE_2",
              amount: 5000,
              currency: "USD",
              status: "authorized",
              order_id: providerOrderId,
            },
          },
        },
        created_at: 1700000000,
      });

      const outcome = await webhookService.processWebhook(db, {
        rawBody: rawPayload,
        signature: signPayload(rawPayload),
        headerEventId: "evt_stale_auth_2",
      });

      expect(outcome.status).toBe("IGNORED");

      const pmtQuery = await db.query<{ status: string }>(
        `SELECT status FROM payments WHERE id = $1`,
        [localPayment.payment.id],
      );
      expect(pmtQuery.rows[0]?.status).toBe("CAPTURED");
    });
  });
});
