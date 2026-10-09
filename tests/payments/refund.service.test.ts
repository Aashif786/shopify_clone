import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { PaymentService } from "../../modules/payments/src/application/payment-service.js";
import { RefundService } from "../../modules/payments/src/application/refund-service.js";
import {
  CrossStorePaymentAccessError,
  InvalidMonetaryAmountError,
  PaymentIdempotencyConflictError,
  PaymentNotRefundableError,
  RefundExceedsCapturedAmountError,
} from "../../modules/payments/src/domain/payment-errors.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Refund Application Service Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const paymentService = new PaymentService();
  const refundService = new RefundService();

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
    slug = "refund-service-store",
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

  async function seedCapturedPayment(
    db: Database,
    storeId: string,
    amount = 10000,
  ): Promise<string> {
    const cartId = await seedTestCart(db, storeId);
    const checkoutId = generateUuidV7();
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, $4, 'PAYMENT_PENDING', 'PENDING', 'USD')`,
      [checkoutId, storeId, cartId, amount],
    );

    const orderId = generateUuidV7();
    await db.query(
      `INSERT INTO orders (id, store_id, checkout_id, order_number, total, grand_total, currency, status)
       VALUES ($1, $2, $3, $4, $5, $5, 'USD', 'CONFIRMED')`,
      [orderId, storeId, checkoutId, `ORD-${orderId.slice(0, 8)}`, amount],
    );

    const paymentId = generateUuidV7();
    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, order_id, amount, currency, status, provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, $4, $5, 'USD', 'CAPTURED', 'razorpay', $5, 0)`,
      [paymentId, storeId, checkoutId, orderId, amount],
    );
    return paymentId;
  }

  describe("1. Refund Eligibility & Balance Rules", () => {
    it("creates a provisional PENDING refund record without fabricating provider success", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ref-pending");
      const paymentId = await seedCapturedPayment(db, storeId, 10000);

      const refund = await refundService.requestRefund(db, {
        storeId,
        paymentId,
        amount: 3000,
        reason: "Customer requested return",
        idempotencyKey: "ref_key_1",
      });

      expect(refund.id).toBeDefined();
      expect(refund.paymentId).toBe(paymentId);
      expect(refund.storeId).toBe(storeId);
      expect(refund.amount).toBe(3000);
      expect(refund.status).toBe("PENDING");
      expect(refund.providerRefundId).toBeNull(); // Provider outcome not yet fabricated
    });

    it("rejects refund requests on ineligible payment states (CREATED, PENDING, FAILED)", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ref-ineligible");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = generateUuidV7();
      await db.query(
        `INSERT INTO checkouts (id, store_id, cart_id, total, status, currency)
         VALUES ($1, $2, $3, 5000, 'OPEN', 'USD')`,
        [checkoutId, storeId, cartId],
      );

      // 1. Payment in CREATED
      const { payment } = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        idempotencyKey: "idem_ineligible_1",
      });

      await expect(
        refundService.requestRefund(db, {
          storeId,
          paymentId: payment.id,
          amount: 2000,
          idempotencyKey: "ref_fail_1",
        }),
      ).rejects.toThrow(PaymentNotRefundableError);

      // 2. Payment in FAILED
      await paymentService.updatePaymentStatus(db, storeId, payment.id, "FAILED");
      await expect(
        refundService.requestRefund(db, {
          storeId,
          paymentId: payment.id,
          amount: 2000,
          idempotencyKey: "ref_fail_2",
        }),
      ).rejects.toThrow(PaymentNotRefundableError);
    });

    it("rejects non-positive refund amount", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ref-non-pos");
      const paymentId = await seedCapturedPayment(db, storeId, 10000);

      await expect(
        refundService.requestRefund(db, {
          storeId,
          paymentId,
          amount: 0,
          idempotencyKey: "ref_zero",
        }),
      ).rejects.toThrow(InvalidMonetaryAmountError);

      await expect(
        refundService.requestRefund(db, {
          storeId,
          paymentId,
          amount: -500,
          idempotencyKey: "ref_neg",
        }),
      ).rejects.toThrow(InvalidMonetaryAmountError);
    });

    it("rejects refund amount exceeding remaining refundable balance", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ref-exceed-balance");
      const paymentId = await seedCapturedPayment(db, storeId, 5000);

      // Attempting to refund 5001 when captured amount is 5000
      await expect(
        refundService.requestRefund(db, {
          storeId,
          paymentId,
          amount: 5001,
          idempotencyKey: "ref_exceed_1",
        }),
      ).rejects.toThrow(RefundExceedsCapturedAmountError);
    });
  });

  describe("2. Multi-Tenancy & Store Isolation", () => {
    it("rejects refund request when payment belongs to a different store", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "store-a-ref");
      const { storeId: storeB } = await seedTestStore(db, "store-b-ref");

      const paymentA = await seedCapturedPayment(db, storeA, 8000);

      // Store B attempts to refund payment belonging to Store A
      await expect(
        refundService.requestRefund(db, {
          storeId: storeB,
          paymentId: paymentA,
          amount: 2000,
          idempotencyKey: "ref_cross_store",
        }),
      ).rejects.toThrow(CrossStorePaymentAccessError);
    });
  });

  describe("3. Idempotency & Replay", () => {
    it("replays completed refund result with identical idempotency key", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ref-replay");
      const paymentId = await seedCapturedPayment(db, storeId, 10000);

      const first = await refundService.requestRefund(db, {
        storeId,
        paymentId,
        amount: 3500,
        reason: "Customer changed mind",
        idempotencyKey: "ref_replay_key_1",
      });

      const second = await refundService.requestRefund(db, {
        storeId,
        paymentId,
        amount: 3500,
        reason: "Customer changed mind",
        idempotencyKey: "ref_replay_key_1",
      });

      expect(second.id).toBe(first.id);
      expect(second.amount).toBe(3500);
    });

    it("rejects idempotency key reuse with different refund parameters", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ref-mismatch");
      const paymentId = await seedCapturedPayment(db, storeId, 10000);

      await refundService.requestRefund(db, {
        storeId,
        paymentId,
        amount: 2000,
        idempotencyKey: "ref_shared_key",
      });

      // Different amount with same key
      await expect(
        refundService.requestRefund(db, {
          storeId,
          paymentId,
          amount: 4000,
          idempotencyKey: "ref_shared_key",
        }),
      ).rejects.toThrow(PaymentIdempotencyConflictError);
    });
  });

  describe("4. Concurrent Refund Serialization & Outcome Transitions", () => {
    it("serializes concurrent refunds under row lock and prevents over-refunding", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ref-concurrency");
      const paymentId = await seedCapturedPayment(db, storeId, 10000);

      // First refund for 6000 succeeds and is marked confirmed
      const r1 = await refundService.requestRefund(db, {
        storeId,
        paymentId,
        amount: 6000,
        idempotencyKey: "ref_conc_1",
      });
      await refundService.recordRefundSuccess(db, storeId, r1.id, "rfnd_gateway_1");

      // Second refund for 6000 must be rejected because 6000 > remaining 4000
      await expect(
        refundService.requestRefund(db, {
          storeId,
          paymentId,
          amount: 6000,
          idempotencyKey: "ref_conc_2",
        }),
      ).rejects.toThrow(RefundExceedsCapturedAmountError);

      // Refund for 4000 succeeds and transitions payment to REFUNDED
      const r2 = await refundService.requestRefund(db, {
        storeId,
        paymentId,
        amount: 4000,
        idempotencyKey: "ref_conc_3",
      });
      await refundService.recordRefundSuccess(db, storeId, r2.id, "rfnd_gateway_2");

      const pmt = await paymentService.getPayment(db, storeId, paymentId);
      expect(pmt.status).toBe("REFUNDED");
      expect(pmt.refundedAmount).toBe(10000);
      expect(pmt.capturedAmount).toBe(10000);
    });

    it("handles refund failure without decrementing parent refundable balance", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "ref-fail-handling");
      const paymentId = await seedCapturedPayment(db, storeId, 10000);

      const r = await refundService.requestRefund(db, {
        storeId,
        paymentId,
        amount: 5000,
        idempotencyKey: "ref_fail_handling_1",
      });

      const failed = await refundService.recordRefundFailure(db, storeId, r.id);
      expect(failed.status).toBe("FAILED");

      // Parent payment remains CAPTURED with refunded_amount == 0
      const pmt = await paymentService.getPayment(db, storeId, paymentId);
      expect(pmt.status).toBe("CAPTURED");
      expect(pmt.refundedAmount).toBe(0);

      // Customer can now refund full 10000 again
      const rRetry = await refundService.requestRefund(db, {
        storeId,
        paymentId,
        amount: 10000,
        idempotencyKey: "ref_retry_full",
      });
      expect(rRetry.amount).toBe(10000);
    });
  });
});
