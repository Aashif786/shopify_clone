import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { PaymentService } from "../../modules/payments/src/application/payment-service.js";
import { PaymentAttemptService } from "../../modules/payments/src/application/payment-attempt-service.js";
import {
  CrossStorePaymentAccessError,
  InvalidCheckoutStateForPaymentError,
  PaymentActiveConflictError,
  PaymentIdempotencyConflictError,
  PaymentNotFoundError,
} from "../../modules/payments/src/domain/payment-errors.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Payment Application Service Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const paymentService = new PaymentService();
  const attemptService = new PaymentAttemptService();

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
    slug = "pmt-service-store",
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
    total = 7500,
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

  describe("1. Payment Creation from Trusted Checkout", () => {
    it("creates payment and initial attempt from trusted checkout amount", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-create-valid");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 12500, "OPEN", "USD");

      const result = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: "idem_create_1",
      });

      expect(result.payment).toBeDefined();
      expect(result.payment.storeId).toBe(storeId);
      expect(result.payment.checkoutId).toBe(checkoutId);
      expect(result.payment.amount).toBe(12500);
      expect(result.payment.currency).toBe("USD");
      expect(result.payment.status).toBe("CREATED");

      expect(result.attempt).toBeDefined();
      expect(result.attempt.paymentId).toBe(result.payment.id);
      expect(result.attempt.attemptNumber).toBe(1);
      expect(result.attempt.amount).toBe(12500);
      expect(result.attempt.currency).toBe("USD");
      expect(result.attempt.status).toBe("INITIATED");

      // Verify checkout transitioned from OPEN to PAYMENT_PENDING
      const chkRes = await db.query<{ status: string }>(
        `SELECT status FROM checkouts WHERE id = $1`,
        [checkoutId],
      );
      expect(chkRes.rows[0]?.status).toBe("PAYMENT_PENDING");
    });

    it("rejects payment creation if checkout is in terminal status", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-create-terminal");
      const cartId = await seedTestCart(db, storeId);

      const completedCheckoutId = await seedTestCheckout(
        db,
        storeId,
        cartId,
        5000,
        "COMPLETED",
      );
      await expect(
        paymentService.createPayment(db, {
          storeId,
          checkoutId: completedCheckoutId,
          idempotencyKey: "idem_completed",
        }),
      ).rejects.toThrow(InvalidCheckoutStateForPaymentError);

      const cancelledCheckoutId = await seedTestCheckout(
        db,
        storeId,
        cartId,
        5000,
        "CANCELLED",
      );
      await expect(
        paymentService.createPayment(db, {
          storeId,
          checkoutId: cancelledCheckoutId,
          idempotencyKey: "idem_cancelled",
        }),
      ).rejects.toThrow(InvalidCheckoutStateForPaymentError);

      const expiredCheckoutId = await seedTestCheckout(
        db,
        storeId,
        cartId,
        5000,
        "EXPIRED",
      );
      await expect(
        paymentService.createPayment(db, {
          storeId,
          checkoutId: expiredCheckoutId,
          idempotencyKey: "idem_expired",
        }),
      ).rejects.toThrow(InvalidCheckoutStateForPaymentError);
    });

    it("rejects payment creation when checkout has zero total", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-zero-total");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 0, "OPEN");

      await expect(
        paymentService.createPayment(db, {
          storeId,
          checkoutId,
          idempotencyKey: "idem_zero",
        }),
      ).rejects.toThrow(InvalidCheckoutStateForPaymentError);
    });
  });

  describe("2. Multi-Tenancy & Store Isolation", () => {
    it("rejects payment creation for checkout belonging to another store", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "store-a-svc");
      const { storeId: storeB } = await seedTestStore(db, "store-b-svc");

      const cartA = await seedTestCart(db, storeA);
      const checkoutA = await seedTestCheckout(db, storeA, cartA, 5000);

      // Store B caller attempts to pay for Store A checkout
      await expect(
        paymentService.createPayment(db, {
          storeId: storeB,
          checkoutId: checkoutA,
          idempotencyKey: "idem_cross_store",
        }),
      ).rejects.toThrow(CrossStorePaymentAccessError);
    });

    it("rejects getPayment when payment belongs to a different store", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "store-a-get");
      const { storeId: storeB } = await seedTestStore(db, "store-b-get");

      const cartA = await seedTestCart(db, storeA);
      const checkoutA = await seedTestCheckout(db, storeA, cartA, 5000);

      const created = await paymentService.createPayment(db, {
        storeId: storeA,
        checkoutId: checkoutA,
        idempotencyKey: "idem_store_a",
      });

      await expect(
        paymentService.getPayment(db, storeB, created.payment.id),
      ).rejects.toThrow(CrossStorePaymentAccessError);
    });
  });

  describe("3. Durable Idempotency & Replay", () => {
    it("replays completed payment result when called with same idempotency key and params", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-idem-replay");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 6000);

      const first = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        idempotencyKey: "idem_replay_key_1",
      });

      const second = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        idempotencyKey: "idem_replay_key_1",
      });

      expect(second.payment.id).toBe(first.payment.id);
      expect(second.attempt.id).toBe(first.attempt.id);
    });

    it("rejects idempotency key reuse with different parameters", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-idem-mismatch");
      const cartId = await seedTestCart(db, storeId);
      const checkoutA = await seedTestCheckout(db, storeId, cartId, 6000);
      const checkoutB = await seedTestCheckout(db, storeId, cartId, 8000);

      await paymentService.createPayment(db, {
        storeId,
        checkoutId: checkoutA,
        idempotencyKey: "idem_shared_key",
      });

      // Different checkoutId with same idempotencyKey must throw
      await expect(
        paymentService.createPayment(db, {
          storeId,
          checkoutId: checkoutB,
          idempotencyKey: "idem_shared_key",
        }),
      ).rejects.toThrow(PaymentIdempotencyConflictError);
    });
  });

  describe("4. Duplicate Active Payment Prevention & Retry Lifecycle", () => {
    it("prevents multiple active payments for the same checkout", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-dup-active");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000);

      await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        idempotencyKey: "idem_act_1",
      });

      // Attempting to create a second payment with a new idempotency key for the same active checkout
      await expect(
        paymentService.createPayment(db, {
          storeId,
          checkoutId,
          idempotencyKey: "idem_act_2",
        }),
      ).rejects.toThrow(PaymentActiveConflictError);
    });

    it("allows a new payment after the previous payment enters FAILED status", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-retry-svc");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000);

      const first = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        idempotencyKey: "idem_try_1",
      });

      // Payment fails terminally
      await paymentService.updatePaymentStatus(db, storeId, first.payment.id, "FAILED");

      // Customer retries checkout payment with new key
      const second = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        idempotencyKey: "idem_try_2",
      });

      expect(second.payment.id).not.toBe(first.payment.id);
      expect(second.payment.status).toBe("CREATED");

      const all = await paymentService.getPaymentsByCheckoutId(db, storeId, checkoutId);
      expect(all).toHaveLength(2);
      expect(all.map((p) => p.status)).toContain("FAILED");
      expect(all.map((p) => p.status)).toContain("CREATED");
    });
  });

  describe("5. Payment Retrieval and Status Management", () => {
    it("updates payment status and amounts correctly", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-status-mgmt");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 10000);

      const created = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        idempotencyKey: "idem_status_test",
      });

      await paymentService.updatePaymentStatus(
        db,
        storeId,
        created.payment.id,
        "PENDING",
      );

      const updated = await paymentService.updatePaymentStatus(
        db,
        storeId,
        created.payment.id,
        "CAPTURED",
        { capturedAmount: 10000 },
      );

      expect(updated.status).toBe("CAPTURED");
      expect(updated.capturedAmount).toBe(10000);

      const fetched = await paymentService.getPayment(db, storeId, created.payment.id);
      expect(fetched.status).toBe("CAPTURED");
      expect(fetched.capturedAmount).toBe(10000);
    });

    it("throws PaymentNotFoundError for non-existent payment", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-not-found");
      const nonExistentId = generateUuidV7();

      await expect(
        paymentService.getPayment(db, storeId, nonExistentId),
      ).rejects.toThrow(PaymentNotFoundError);
    });
  });

  describe("6. Payment Attempt Service Integration", () => {
    it("creates subsequent attempts with incremented attempt numbers and frozen amounts", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-att-subsequent");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 8500);

      const { payment } = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        idempotencyKey: "idem_att_test",
      });

      // Create attempt 2
      const attempt2 = await attemptService.createAttempt(db, {
        storeId,
        paymentId: payment.id,
        provider: "razorpay",
        idempotencyKey: "idem_att_2",
      });

      expect(attempt2.attemptNumber).toBe(2);
      expect(attempt2.amount).toBe(8500);
      expect(attempt2.currency).toBe("USD");
      expect(attempt2.status).toBe("INITIATED");

      const attempts = await attemptService.getAttempts(db, storeId, payment.id);
      expect(attempts).toHaveLength(2);
      expect(attempts.map((a) => a.attemptNumber)).toEqual([1, 2]);
    });

    it("updates attempt status and metadata safely", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "pmt-att-update");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000);

      const { attempt } = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        idempotencyKey: "idem_att_upd",
      });

      await attemptService.updateAttemptStatus(
        db,
        storeId,
        attempt.id,
        "PENDING",
        { providerOrderId: "order_xyz_123" },
      );

      const updated = await attemptService.updateAttemptStatus(
        db,
        storeId,
        attempt.id,
        "CAPTURED",
        {
          providerPaymentId: "pay_xyz_123",
          providerSignature: "sig_abc_456",
        },
      );

      expect(updated.status).toBe("CAPTURED");
      expect(updated.providerPaymentId).toBe("pay_xyz_123");
    });
  });
});
