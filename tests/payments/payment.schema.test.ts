import { afterEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
  PaymentRepository,
  PaymentAttemptRepository,
  PaymentWebhookEventRepository,
  RefundRepository,
  IdempotencyRepository,
} from "@shopify-clone/db";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Payments PostgreSQL Schema Integration", { timeout: 30_000 }, () => {
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
    slug = "store-payments",
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
  ): Promise<string> {
    const checkoutId = generateUuidV7();
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, $4, 'PAYMENT_PENDING', 'PENDING', 'USD')`,
      [checkoutId, storeId, cartId, total],
    );
    return checkoutId;
  }

  async function seedTestOrder(
    db: Database,
    storeId: string,
    checkoutId: string,
    total = 5000,
  ): Promise<string> {
    const orderId = generateUuidV7();
    await db.query(
      `INSERT INTO orders (id, store_id, checkout_id, order_number, total, grand_total, currency, status)
       VALUES ($1, $2, $3, $4, $5, $5, 'USD', 'CONFIRMED')`,
      [orderId, storeId, checkoutId, `ORD-${orderId.slice(0, 8)}`, total],
    );
    return orderId;
  }

  describe("1. Migration & Table Existence", () => {
    it("creates all 5 required payment domain tables", async () => {
      const db = await setupDb();
      const res = await db.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name IN (
             'payments',
             'payment_attempts',
             'payment_webhook_events',
             'refunds',
             'idempotency_records'
           )
         ORDER BY table_name ASC`,
      );

      const tableNames = res.rows.map((r) => r.table_name);
      expect(tableNames).toEqual([
        "idempotency_records",
        "payment_attempts",
        "payment_webhook_events",
        "payments",
        "refunds",
      ]);
    });
  });

  describe("2. Payments Table Schema & Financial Constraints", () => {
    it("creates a payment record with valid defaults and stores amounts as bigint", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-valid");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 10000);
      const paymentId = generateUuidV7();

      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, amount, currency)
         VALUES ($1, $2, $3, $4, 'USD')`,
        [paymentId, storeId, checkoutId, 10000],
      );

      const res = await db.query<{
        id: string;
        store_id: string;
        checkout_id: string;
        amount: string;
        currency: string;
        status: string;
        provider: string;
        captured_amount: string;
        refunded_amount: string;
      }>(`SELECT * FROM payments WHERE id = $1`, [paymentId]);

      expect(res.rows).toHaveLength(1);
      const row = res.rows[0]!;
      expect(row.id).toBe(paymentId);
      expect(row.store_id).toBe(storeId);
      expect(row.checkout_id).toBe(checkoutId);
      expect(Number(row.amount)).toBe(10000);
      expect(row.currency).toBe("USD");
      expect(row.status).toBe("CREATED");
      expect(row.provider).toBe("razorpay");
      expect(Number(row.captured_amount)).toBe(0);
      expect(Number(row.refunded_amount)).toBe(0);
    });

    it("rejects non-positive payment amount via check constraint", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-amount-check");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);

      await expect(
        db.query(
          `INSERT INTO payments (id, store_id, checkout_id, amount, currency)
           VALUES ($1, $2, $3, 0, 'USD')`,
          [generateUuidV7(), storeId, checkoutId],
        ),
      ).rejects.toThrow(/payments_amount_check/);

      await expect(
        db.query(
          `INSERT INTO payments (id, store_id, checkout_id, amount, currency)
           VALUES ($1, $2, $3, -500, 'USD')`,
          [generateUuidV7(), storeId, checkoutId],
        ),
      ).rejects.toThrow(/payments_amount_check/);
    });

    it("rejects captured_amount exceeding payment amount", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-cap-check");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);

      await expect(
        db.query(
          `INSERT INTO payments (id, store_id, checkout_id, amount, currency, captured_amount)
           VALUES ($1, $2, $3, 1000, 'USD', 1001)`,
          [generateUuidV7(), storeId, checkoutId],
        ),
      ).rejects.toThrow(/payments_captured_amount_check/);
    });

    it("rejects negative captured_amount", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-neg-cap");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);

      await expect(
        db.query(
          `INSERT INTO payments (id, store_id, checkout_id, amount, currency, captured_amount)
           VALUES ($1, $2, $3, 1000, 'USD', -10)`,
          [generateUuidV7(), storeId, checkoutId],
        ),
      ).rejects.toThrow(/payments_captured_amount_check/);
    });

    it("rejects refunded_amount exceeding captured_amount", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-ref-check");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);

      await expect(
        db.query(
          `INSERT INTO payments (id, store_id, checkout_id, amount, currency, captured_amount, refunded_amount)
           VALUES ($1, $2, $3, 5000, 'USD', 3000, 3001)`,
          [generateUuidV7(), storeId, checkoutId],
        ),
      ).rejects.toThrow(/payments_refunded_amount_check/);
    });

    it("rejects invalid payment status and currency format", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-status-curr");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);

      await expect(
        db.query(
          `INSERT INTO payments (id, store_id, checkout_id, amount, currency, status)
           VALUES ($1, $2, $3, 1000, 'USD', 'UNKNOWN_STATUS')`,
          [generateUuidV7(), storeId, checkoutId],
        ),
      ).rejects.toThrow(/payments_status_check/);

      await expect(
        db.query(
          `INSERT INTO payments (id, store_id, checkout_id, amount, currency)
           VALUES ($1, $2, $3, 1000, 'usd')`,
          [generateUuidV7(), storeId, checkoutId],
        ),
      ).rejects.toThrow(/payments_currency_format_check/);
    });
  });

  describe("3. Active Payment Uniqueness & Retry Lifecycle", () => {
    it("enforces at most one active payment per checkout", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-unique-active");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);

      const pmt1 = generateUuidV7();
      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, amount, currency, status)
         VALUES ($1, $2, $3, 5000, 'USD', 'CREATED')`,
        [pmt1, storeId, checkoutId],
      );

      // Attempting to create a second active payment for the same checkout
      await expect(
        db.query(
          `INSERT INTO payments (id, store_id, checkout_id, amount, currency, status)
           VALUES ($1, $2, $3, 5000, 'USD', 'PENDING')`,
          [generateUuidV7(), storeId, checkoutId],
        ),
      ).rejects.toThrow(/payments_active_checkout_idx/);
    });

    it("permits a new payment after an earlier payment enters FAILED status", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-retry-failed");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);

      const pmt1 = generateUuidV7();
      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, amount, currency, status)
         VALUES ($1, $2, $3, 5000, 'USD', 'PENDING')`,
        [pmt1, storeId, checkoutId],
      );

      // Transition pmt1 to FAILED
      await db.query(`UPDATE payments SET status = 'FAILED' WHERE id = $1`, [pmt1]);

      // Retry: creating a new payment for the checkout succeeds
      const pmt2 = generateUuidV7();
      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, amount, currency, status)
         VALUES ($1, $2, $3, 5000, 'USD', 'CREATED')`,
        [pmt2, storeId, checkoutId],
      );

      const res = await db.query<{ id: string; status: string }>(
        `SELECT id, status FROM payments WHERE checkout_id = $1 ORDER BY created_at ASC`,
        [checkoutId],
      );
      expect(res.rows).toHaveLength(2);
      expect(res.rows[0]?.status).toBe("FAILED");
      expect(res.rows[1]?.status).toBe("CREATED");
    });

    it("permits a new payment after an earlier payment enters CANCELLED status", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-retry-cancelled");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);

      const pmt1 = generateUuidV7();
      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, amount, currency, status)
         VALUES ($1, $2, $3, 5000, 'USD', 'CREATED')`,
        [pmt1, storeId, checkoutId],
      );

      await db.query(`UPDATE payments SET status = 'CANCELLED' WHERE id = $1`, [pmt1]);

      const pmt2 = generateUuidV7();
      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, amount, currency, status)
         VALUES ($1, $2, $3, 5000, 'USD', 'CREATED')`,
        [pmt2, storeId, checkoutId],
      );

      const res = await db.query<{ id: string; status: string }>(
        `SELECT id, status FROM payments WHERE checkout_id = $1`,
        [checkoutId],
      );
      expect(res.rows).toHaveLength(2);
    });
  });

  describe("4. Payment Attempts Schema & Uniqueness", () => {
    it("persists payment attempts and cascades delete with parent payment", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-att-cascade");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);
      const paymentId = generateUuidV7();

      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, amount, currency)
         VALUES ($1, $2, $3, 4000, 'USD')`,
        [paymentId, storeId, checkoutId],
      );

      const attemptId = generateUuidV7();
      await db.query(
        `INSERT INTO payment_attempts (
           id, payment_id, store_id, attempt_number, provider,
           provider_order_id, amount, currency, status
         ) VALUES ($1, $2, $3, 1, 'razorpay', 'order_xyz', 4000, 'USD', 'INITIATED')`,
        [attemptId, paymentId, storeId],
      );

      const attRes = await db.query<{ id: string }>(
        `SELECT id FROM payment_attempts WHERE id = $1`,
        [attemptId],
      );
      expect(attRes.rows).toHaveLength(1);

      // Deleting parent payment cascades to attempts
      await db.query(`DELETE FROM payments WHERE id = $1`, [paymentId]);
      const attAfter = await db.query(
        `SELECT id FROM payment_attempts WHERE id = $1`,
        [attemptId],
      );
      expect(attAfter.rows).toHaveLength(0);
    });

    it("rejects duplicate attempt numbers for the same payment", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-att-dup-num");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);
      const paymentId = generateUuidV7();

      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, amount, currency)
         VALUES ($1, $2, $3, 3000, 'USD')`,
        [paymentId, storeId, checkoutId],
      );

      await db.query(
        `INSERT INTO payment_attempts (
           id, payment_id, store_id, attempt_number, amount, currency
         ) VALUES ($1, $2, $3, 1, 3000, 'USD')`,
        [generateUuidV7(), paymentId, storeId],
      );

      await expect(
        db.query(
          `INSERT INTO payment_attempts (
             id, payment_id, store_id, attempt_number, amount, currency
           ) VALUES ($1, $2, $3, 1, 3000, 'USD')`,
          [generateUuidV7(), paymentId, storeId],
        ),
      ).rejects.toThrow(/payment_attempts_payment_attempt_unique/);
    });

    it("rejects duplicate non-null provider_payment_id", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-att-dup-prov");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);
      const paymentId = generateUuidV7();

      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, amount, currency)
         VALUES ($1, $2, $3, 2000, 'USD')`,
        [paymentId, storeId, checkoutId],
      );

      await db.query(
        `INSERT INTO payment_attempts (
           id, payment_id, store_id, attempt_number, provider, provider_payment_id, amount, currency
         ) VALUES ($1, $2, $3, 1, 'razorpay', 'pay_12345', 2000, 'USD')`,
        [generateUuidV7(), paymentId, storeId],
      );

      // Same provider_payment_id in a different attempt
      await expect(
        db.query(
          `INSERT INTO payment_attempts (
             id, payment_id, store_id, attempt_number, provider, provider_payment_id, amount, currency
           ) VALUES ($1, $2, $3, 2, 'razorpay', 'pay_12345', 2000, 'USD')`,
          [generateUuidV7(), paymentId, storeId],
        ),
      ).rejects.toThrow(/payment_attempts_provider_payment_idx/);
    });
  });

  describe("5. Payment Webhook Events Deduplication", () => {
    it("persists webhook event and rejects duplicate provider_event_id", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-wh-dup");
      const eventId = generateUuidV7();

      await db.query(
        `INSERT INTO payment_webhook_events (
           id, store_id, provider, provider_event_id, event_type, payload
         ) VALUES ($1, $2, 'razorpay', 'evt_abc123', 'payment.captured', '{"status":"captured"}'::jsonb)`,
        [eventId, storeId],
      );

      // Attempting duplicate insertion with same provider and provider_event_id
      await expect(
        db.query(
          `INSERT INTO payment_webhook_events (
             id, store_id, provider, provider_event_id, event_type, payload
           ) VALUES ($1, $2, 'razorpay', 'evt_abc123', 'payment.captured', '{"status":"captured"}'::jsonb)`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow(/payment_webhook_events_provider_event_id_unique/);
    });

    it("rejects invalid webhook event status", async () => {
      const db = await setupDb();

      await expect(
        db.query(
          `INSERT INTO payment_webhook_events (
             id, provider, provider_event_id, event_type, payload, status
           ) VALUES ($1, 'razorpay', 'evt_xyz', 'order.paid', '{}'::jsonb, 'INVALID_WH_STATUS')`,
          [generateUuidV7()],
        ),
      ).rejects.toThrow(/payment_webhook_events_status_check/);
    });
  });

  describe("6. Refunds Schema & Concurrency / Accounting Invariants", () => {
    it("inserts valid refund record and enforces non-positive amount check", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-ref-valid");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);
      const paymentId = generateUuidV7();
      const orderId = await seedTestOrder(db, storeId, checkoutId, 10000);

      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, amount, currency, status, captured_amount)
         VALUES ($1, $2, $3, 10000, 'USD', 'CAPTURED', 10000)`,
        [paymentId, storeId, checkoutId],
      );

      const refundId = generateUuidV7();
      await db.query(
        `INSERT INTO refunds (
           id, store_id, payment_id, order_id, amount, currency, status
         ) VALUES ($1, $2, $3, $4, 2500, 'USD', 'PENDING')`,
        [refundId, storeId, paymentId, orderId],
      );

      const res = await db.query<{ id: string; amount: string; status: string }>(
        `SELECT id, amount, status FROM refunds WHERE id = $1`,
        [refundId],
      );
      expect(res.rows).toHaveLength(1);
      expect(Number(res.rows[0]?.amount)).toBe(2500);
      expect(res.rows[0]?.status).toBe("PENDING");

      // Non-positive amount check
      await expect(
        db.query(
          `INSERT INTO refunds (
             id, store_id, payment_id, order_id, amount, currency
           ) VALUES ($1, $2, $3, $4, 0, 'USD')`,
          [generateUuidV7(), storeId, paymentId, orderId],
        ),
      ).rejects.toThrow(/refunds_amount_check/);
    });

    it("rejects duplicate provider_refund_id", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-ref-dup-prov");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);
      const paymentId = generateUuidV7();
      const orderId = await seedTestOrder(db, storeId, checkoutId, 5000);

      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, amount, currency, status, captured_amount)
         VALUES ($1, $2, $3, 5000, 'USD', 'CAPTURED', 5000)`,
        [paymentId, storeId, checkoutId],
      );

      await db.query(
        `INSERT INTO refunds (
           id, store_id, payment_id, order_id, provider, provider_refund_id, amount, currency
         ) VALUES ($1, $2, $3, $4, 'razorpay', 'rfnd_001', 2000, 'USD')`,
        [generateUuidV7(), storeId, paymentId, orderId],
      );

      await expect(
        db.query(
          `INSERT INTO refunds (
             id, store_id, payment_id, order_id, provider, provider_refund_id, amount, currency
           ) VALUES ($1, $2, $3, $4, 'razorpay', 'rfnd_001', 1000, 'USD')`,
          [generateUuidV7(), storeId, paymentId, orderId],
        ),
      ).rejects.toThrow(/refunds_provider_refund_idx/);
    });

    it("rejects duplicate refund idempotency key within the same store", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-ref-dup-idem");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);
      const paymentId = generateUuidV7();
      const orderId = await seedTestOrder(db, storeId, checkoutId, 5000);

      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, amount, currency, status, captured_amount)
         VALUES ($1, $2, $3, 5000, 'USD', 'CAPTURED', 5000)`,
        [paymentId, storeId, checkoutId],
      );

      await db.query(
        `INSERT INTO refunds (
           id, store_id, payment_id, order_id, amount, currency, idempotency_key
         ) VALUES ($1, $2, $3, $4, 1000, 'USD', 'idem_refund_1')`,
        [generateUuidV7(), storeId, paymentId, orderId],
      );

      await expect(
        db.query(
          `INSERT INTO refunds (
             id, store_id, payment_id, order_id, amount, currency, idempotency_key
           ) VALUES ($1, $2, $3, $4, 1000, 'USD', 'idem_refund_1')`,
          [generateUuidV7(), storeId, paymentId, orderId],
        ),
      ).rejects.toThrow(/refunds_idempotency_idx/);
    });

    it("enforces payment cumulative refund invariant: refunded_amount <= captured_amount", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-ref-overflow");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);
      const paymentId = generateUuidV7();

      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, amount, currency, status, captured_amount, refunded_amount)
         VALUES ($1, $2, $3, 5000, 'USD', 'CAPTURED', 5000, 0)`,
        [paymentId, storeId, checkoutId],
      );

      // First partial refund updates payment.refunded_amount to 3000 (valid)
      await db.query(
        `UPDATE payments SET refunded_amount = 3000, status = 'PARTIALLY_REFUNDED' WHERE id = $1`,
        [paymentId],
      );

      // Second refund attempting to exceed captured amount (3000 + 2500 = 5500 > 5000)
      await expect(
        db.query(
          `UPDATE payments SET refunded_amount = 5500 WHERE id = $1`,
          [paymentId],
        ),
      ).rejects.toThrow(/payments_refunded_amount_check/);
    });
  });

  describe("7. Idempotency Records Constraints", () => {
    it("inserts record and enforces uniqueness on (store_id, scope, idempotency_key)", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "idem-test");
      const id1 = generateUuidV7();
      const expiresAt = new Date(Date.now() + 86400000).toISOString();

      await db.query(
        `INSERT INTO idempotency_records (
           id, store_id, scope, idempotency_key, request_hash, expires_at
         ) VALUES ($1, $2, 'payments:create', 'key_123', 'hash_abc', $3)`,
        [id1, storeId, expiresAt],
      );

      // Duplicate in same store and scope
      await expect(
        db.query(
          `INSERT INTO idempotency_records (
             id, store_id, scope, idempotency_key, request_hash, expires_at
           ) VALUES ($1, $2, 'payments:create', 'key_123', 'hash_diff', $3)`,
          [generateUuidV7(), storeId, expiresAt],
        ),
      ).rejects.toThrow(/idempotency_records_store_scope_key_unique/);

      // Same key in different scope succeeds
      const diffScopeId = generateUuidV7();
      await db.query(
        `INSERT INTO idempotency_records (
           id, store_id, scope, idempotency_key, request_hash, expires_at
         ) VALUES ($1, $2, 'payments:refund', 'key_123', 'hash_abc', $3)`,
        [diffScopeId, storeId, expiresAt],
      );
    });
  });

  describe("8. Multi-Tenancy & Cross-Store Isolation", () => {
    it("rejects creating a payment for a checkout belonging to a different store", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "store-a-pmt");
      const { storeId: storeB } = await seedTestStore(db, "store-b-pmt");

      const cartA = await seedTestCart(db, storeA);
      const checkoutA = await seedTestCheckout(db, storeA, cartA);

      // Attempt to associate checkout from Store A with Store B payment
      await expect(
        db.query(
          `INSERT INTO payments (id, store_id, checkout_id, amount, currency)
           VALUES ($1, $2, $3, 1000, 'USD')`,
          [generateUuidV7(), storeB, checkoutA],
        ),
      ).rejects.toThrow(/payments_checkout_store_fkey/);
    });

    it("rejects creating a payment attempt for a payment belonging to a different store", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "store-a-att");
      const { storeId: storeB } = await seedTestStore(db, "store-b-att");

      const cartA = await seedTestCart(db, storeA);
      const checkoutA = await seedTestCheckout(db, storeA, cartA);
      const paymentA = generateUuidV7();

      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, amount, currency)
         VALUES ($1, $2, $3, 1000, 'USD')`,
        [paymentA, storeA, checkoutA],
      );

      // Attempt to attach attempt in Store B to payment in Store A
      await expect(
        db.query(
          `INSERT INTO payment_attempts (
             id, payment_id, store_id, attempt_number, amount, currency
           ) VALUES ($1, $2, $3, 1, 1000, 'USD')`,
          [generateUuidV7(), paymentA, storeB],
        ),
      ).rejects.toThrow(/payment_attempts_payment_store_fkey/);
    });

    it("rejects creating a refund for a payment belonging to a different store", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "store-a-rfnd");
      const { storeId: storeB } = await seedTestStore(db, "store-b-rfnd");

      const cartA = await seedTestCart(db, storeA);
      const checkoutA = await seedTestCheckout(db, storeA, cartA);
      const paymentA = generateUuidV7();

      await db.query(
        `INSERT INTO payments (id, store_id, checkout_id, amount, currency, status, captured_amount)
         VALUES ($1, $2, $3, 1000, 'USD', 'CAPTURED', 1000)`,
        [paymentA, storeA, checkoutA],
      );

      const cartB = await seedTestCart(db, storeB);
      const checkoutB = await seedTestCheckout(db, storeB, cartB);
      const orderB = await seedTestOrder(db, storeB, checkoutB, 500);

      // Attempt to attach refund in Store B to payment in Store A
      await expect(
        db.query(
          `INSERT INTO refunds (
             id, store_id, payment_id, order_id, amount, currency
           ) VALUES ($1, $2, $3, $4, 500, 'USD')`,
          [generateUuidV7(), storeB, paymentA, orderB],
        ),
      ).rejects.toThrow(/refunds_payment_store_fkey/);
    });
  });

  describe("9. Repositories Integration", () => {
    it("exercises PaymentRepository CRUD and row-locking", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "repo-payment");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);
      const repo = new PaymentRepository();
      const paymentId = generateUuidV7();

      // Create
      const created = await repo.create(db, {
        id: paymentId,
        storeId,
        checkoutId,
        amount: 8000,
        currency: "USD",
      });
      expect(created.id).toBe(paymentId);
      expect(created.status).toBe("CREATED");

      // Find by id
      const found = await repo.findById(db, storeId, paymentId);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(paymentId);

      // Find active by checkout id
      const active = await repo.findActiveByCheckoutId(db, storeId, checkoutId);
      expect(active?.id).toBe(paymentId);

      // Row-lock within transaction
      await db.withTransaction(async (tx) => {
        const locked = await repo.findByIdForUpdate(tx, storeId, paymentId);
        expect(locked?.id).toBe(paymentId);

        // Update status and amounts
        const updated = await repo.updateStatus(tx, storeId, paymentId, "CAPTURED", {
          capturedAmount: 8000,
        });
        expect(updated?.status).toBe("CAPTURED");
        expect(Number(updated?.captured_amount)).toBe(8000);
      });
    });

    it("exercises PaymentAttemptRepository create, list, and status update", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "repo-att");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);
      const pmtRepo = new PaymentRepository();
      const attRepo = new PaymentAttemptRepository();
      const paymentId = generateUuidV7();

      await pmtRepo.create(db, {
        id: paymentId,
        storeId,
        checkoutId,
        amount: 5000,
        currency: "USD",
      });

      const attemptId = generateUuidV7();
      await attRepo.create(db, {
        id: attemptId,
        paymentId,
        storeId,
        attemptNumber: 1,
        provider: "razorpay",
        providerOrderId: "order_123",
        amount: 5000,
        currency: "USD",
        status: "INITIATED",
      });

      const latestNumber = await attRepo.getLatestAttemptNumber(db, paymentId);
      expect(latestNumber).toBe(1);

      const attempts = await attRepo.findByPaymentId(db, storeId, paymentId);
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.provider_order_id).toBe("order_123");

      const updated = await attRepo.updateStatus(db, storeId, attemptId, "CAPTURED", {
        providerPaymentId: "pay_captured_1",
      });
      expect(updated?.status).toBe("CAPTURED");
      expect(updated?.provider_payment_id).toBe("pay_captured_1");
    });

    it("exercises PaymentWebhookEventRepository create and markProcessed", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "repo-wh");
      const repo = new PaymentWebhookEventRepository();
      const eventId = generateUuidV7();

      const created = await repo.create(db, {
        id: eventId,
        storeId,
        provider: "razorpay",
        providerEventId: "evt_test_999",
        eventType: "payment.captured",
        signatureVerified: true,
        payload: { id: "pay_test" },
      });
      expect(created.provider_event_id).toBe("evt_test_999");
      expect(created.signature_verified).toBe(true);
      expect(created.status).toBe("RECEIVED");

      const processed = await repo.markProcessed(db, eventId, "PROCESSED");
      expect(processed?.status).toBe("PROCESSED");
      expect(processed?.processed_at).not.toBeNull();
    });

    it("exercises RefundRepository create, findByIdempotencyKey, and updateStatus", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "repo-refund");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId);
      const pmtRepo = new PaymentRepository();
      const refRepo = new RefundRepository();
      const paymentId = generateUuidV7();
      const orderId = await seedTestOrder(db, storeId, checkoutId, 4000);

      await pmtRepo.create(db, {
        id: paymentId,
        storeId,
        checkoutId,
        amount: 4000,
        currency: "USD",
        status: "CAPTURED",
        capturedAmount: 4000,
      });

      const refundId = generateUuidV7();
      await refRepo.create(db, {
        id: refundId,
        storeId,
        paymentId,
        orderId,
        amount: 2000,
        currency: "USD",
        idempotencyKey: "ref_key_1",
      });

      const found = await refRepo.findByIdempotencyKey(db, storeId, "ref_key_1");
      expect(found).not.toBeNull();
      expect(found?.id).toBe(refundId);

      const succeeded = await refRepo.updateStatus(db, storeId, refundId, "SUCCEEDED", {
        providerRefundId: "rfnd_razorpay_99",
      });
      expect(succeeded?.status).toBe("SUCCEEDED");
      expect(succeeded?.provider_refund_id).toBe("rfnd_razorpay_99");
    });

    it("exercises IdempotencyRepository atomic reservation, conflict detection, and completion", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "repo-idem");
      const repo = new IdempotencyRepository();
      const expiresAt = new Date(Date.now() + 86400000);

      // First reservation succeeds
      const first = await repo.reserve(db, {
        id: generateUuidV7(),
        storeId,
        scope: "payments:create",
        idempotencyKey: "atomic_key_1",
        requestHash: "sha256_hash_1",
        expiresAt,
      });
      expect(first.reserved).toBe(true);
      expect(first.record.status).toBe("IN_PROGRESS");

      // Concurrent retry with same key is recognized and returns existing record
      const second = await repo.reserve(db, {
        id: generateUuidV7(),
        storeId,
        scope: "payments:create",
        idempotencyKey: "atomic_key_1",
        requestHash: "sha256_hash_1",
        expiresAt,
      });
      expect(second.reserved).toBe(false);
      expect(second.record.id).toBe(first.record.id);

      // Complete the operation
      const completed = await repo.complete(
        db,
        storeId,
        "payments:create",
        "atomic_key_1",
        201,
        { paymentId: "pmt_abc" },
      );
      expect(completed?.status).toBe("COMPLETED");
      expect(completed?.response_status).toBe(201);
      expect(completed?.response_body).toEqual({ paymentId: "pmt_abc" });
    });
  });
});
