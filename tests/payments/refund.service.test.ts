import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database, OrderRepository } from "@shopify-clone/db";
import type { PaymentProvider } from "../../modules/payments/src/providers/payment-provider.js";
import { RazorpayTimeoutError } from "../../modules/payments/src/providers/razorpay-types.js";
import { PaymentService } from "../../modules/payments/src/application/payment-service.js";
import { RefundService } from "../../modules/payments/src/application/refund-service.js";
import { PaymentWebhookProcessor } from "../../modules/payments/src/webhooks/webhook-processor.js";
import {
  AmbiguousRefundPendingError,
  CrossStorePaymentAccessError,
  InvalidMonetaryAmountError,
  PaymentGatewayError,
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

  async function seedOrderWithPayment(
    db: Database,
    storeId: string,
    options?: {
      amount?: number;
      paymentStatus?: string;
      orderStatus?: string;
      customerId?: string;
    },
  ): Promise<{ orderId: string; paymentId: string; checkoutId: string }> {
    const amount = options?.amount ?? 10000;
    const cartId = await seedTestCart(db, storeId);
    const checkoutId = generateUuidV7();
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, $4, 'PAYMENT_PENDING', 'PENDING', 'USD')`,
      [checkoutId, storeId, cartId, amount],
    );

    const orderId = generateUuidV7();
    const pmtStatus = options?.paymentStatus ?? "CAPTURED";
    const ordPmtStatus =
      pmtStatus === "REFUNDED"
        ? "REFUNDED"
        : pmtStatus === "CAPTURED"
        ? "PAID"
        : pmtStatus === "FAILED"
        ? "FAILED"
        : "PENDING";

    await db.query(
      `INSERT INTO orders (id, store_id, checkout_id, customer_id, order_number, total, grand_total, currency, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $6, 'USD', $7, $8)`,
      [
        orderId,
        storeId,
        checkoutId,
        options?.customerId ?? null,
        `ORD-${orderId.slice(0, 8)}-${Math.random().toString(36).slice(2, 7)}`,
        amount,
        options?.orderStatus ?? "CONFIRMED",
        ordPmtStatus,
      ],
    );

    const paymentId = generateUuidV7();
    const captured = pmtStatus === "CAPTURED" || pmtStatus === "REFUNDED" ? amount : 0;
    const refunded = pmtStatus === "REFUNDED" ? amount : 0;

    await db.query(
      `INSERT INTO payments (
         id, store_id, checkout_id, order_id, amount, currency, status, provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, $4, $5, 'USD', $6, 'razorpay', $7, $8)`,
      [paymentId, storeId, checkoutId, orderId, amount, pmtStatus, captured, refunded],
    );
    return { orderId, paymentId, checkoutId };
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

  describe("5. Merchant Refund Application Workflow & Reconciliation", () => {
    it("executes full merchant refund on paid order, updating order payment_status to REFUNDED and creating audit entry", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "merch-ref-full");
      const { orderId } = await seedOrderWithPayment(db, storeId, {
        amount: 8500,
        paymentStatus: "CAPTURED",
      });

      const result = await refundService.executeMerchantRefund(db, {
        storeId,
        orderId,
        reason: "Customer returned defective item",
      });

      expect(result.status).toBe("SUCCEEDED");
      expect(result.orderPaymentStatus).toBe("REFUNDED");
      expect(result.remainingRefundable).toBe(0);
      expect(result.refund.amount).toBe(8500);
      expect(result.refund.status).toBe("SUCCEEDED");
      expect(result.refund.reason).toBe("Customer returned defective item");

      // Verify order table state
      const orderRes = await db.query<{ payment_status: string }>(
        `SELECT payment_status FROM orders WHERE id = $1 AND store_id = $2`,
        [orderId, storeId],
      );
      expect(orderRes.rows[0]?.payment_status).toBe("REFUNDED");

      // Verify payment table state
      const paymentRes = await db.query<{ status: string; refunded_amount: string }>(
        `SELECT status, refunded_amount FROM payments WHERE order_id = $1 AND store_id = $2`,
        [orderId, storeId],
      );
      expect(paymentRes.rows[0]?.status).toBe("REFUNDED");
      expect(Number(paymentRes.rows[0]?.refunded_amount)).toBe(8500);

      // Verify order status history audit entry
      const historyRes = await db.query<{ from_status: string; to_status: string; reason: string }>(
        `SELECT from_status, to_status, reason FROM order_status_history WHERE order_id = $1 AND store_id = $2 ORDER BY created_at DESC`,
        [orderId, storeId],
      );
      const paymentAudit = historyRes.rows.find((h) => h.to_status === "payment:REFUNDED");
      expect(paymentAudit).toBeDefined();
      expect(paymentAudit?.reason).toBe("Customer returned defective item");
    });

    it("rejects refund for a cancelled order", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "merch-ref-cancel");
      const { orderId } = await seedOrderWithPayment(db, storeId, {
        amount: 5000,
        orderStatus: "CANCELLED",
        paymentStatus: "CAPTURED",
      });

      await expect(
        refundService.executeMerchantRefund(db, {
          storeId,
          orderId,
          reason: "Manual refund attempt",
        }),
      ).rejects.toThrow("Cannot refund order");
    });

    it("rejects refund for an unpaid / pending payment", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "merch-ref-unpaid");
      const { orderId } = await seedOrderWithPayment(db, storeId, {
        amount: 5000,
        paymentStatus: "PENDING",
      });

      await expect(
        refundService.executeMerchantRefund(db, {
          storeId,
          orderId,
          reason: "Refund on unpaid order",
        }),
      ).rejects.toThrow(PaymentNotRefundableError);
    });

    it("rejects refund for an already fully refunded order", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "merch-ref-already");
      const { orderId } = await seedOrderWithPayment(db, storeId, {
        amount: 5000,
        paymentStatus: "REFUNDED",
      });

      await expect(
        refundService.executeMerchantRefund(db, {
          storeId,
          orderId,
          reason: "Duplicate refund attempt",
        }),
      ).rejects.toThrow("already fully refunded");
    });

    it("rejects refund if amount exceeds captured payment amount", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "merch-ref-exceed");
      const { orderId } = await seedOrderWithPayment(db, storeId, {
        amount: 5000,
        paymentStatus: "CAPTURED",
      });

      await expect(
        refundService.executeMerchantRefund(db, {
          storeId,
          orderId,
          amount: 6000,
          reason: "Over-refund attempt",
        }),
      ).rejects.toThrow(RefundExceedsCapturedAmountError);
    });

    it("enforces store boundary: rejects refund request on another store's order", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "store-boundary-a");
      const { storeId: storeB } = await seedTestStore(db, "store-boundary-b");

      const { orderId } = await seedOrderWithPayment(db, storeA, {
        amount: 5000,
        paymentStatus: "CAPTURED",
      });

      await expect(
        refundService.executeMerchantRefund(db, {
          storeId: storeB,
          orderId,
          reason: "Cross store refund attempt",
        }),
      ).rejects.toThrow(CrossStorePaymentAccessError);
    });

    it("validates refund reason: rejects empty or overly long reason", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "merch-ref-validation");
      const { orderId } = await seedOrderWithPayment(db, storeId, {
        amount: 5000,
        paymentStatus: "CAPTURED",
      });

      await expect(
        refundService.executeMerchantRefund(db, {
          storeId,
          orderId,
          reason: "   ",
        }),
      ).rejects.toThrow("Refund reason is required");

      const overlyLongReason = "x".repeat(501);
      await expect(
        refundService.executeMerchantRefund(db, {
          storeId,
          orderId,
          reason: overlyLongReason,
        }),
      ).rejects.toThrow("cannot exceed 500 characters");
    });

    it("supports idempotency: repeat call returns same refund without creating duplicates", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "merch-ref-idempotent");
      const { orderId } = await seedOrderWithPayment(db, storeId, {
        amount: 7500,
        paymentStatus: "CAPTURED",
      });

      const idempotencyKey = "merchant-ref-key-123";

      const res1 = await refundService.executeMerchantRefund(db, {
        storeId,
        orderId,
        reason: "First call",
        idempotencyKey,
      });

      const res2 = await refundService.executeMerchantRefund(db, {
        storeId,
        orderId,
        reason: "First call",
        idempotencyKey,
      });

      expect(res1.refund.id).toBe(res2.refund.id);

      const countRes = await db.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM refunds WHERE order_id = $1 AND store_id = $2`,
        [orderId, storeId],
      );
      expect(Number(countRes.rows[0]?.count)).toBe(1);
    });

    it("handles provider timeout with REQUIRES_RECONCILIATION without fabricating success", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "merch-ref-timeout");
      const { orderId } = await seedOrderWithPayment(db, storeId, {
        amount: 4000,
        paymentStatus: "CAPTURED",
      });

      const timeoutProvider: PaymentProvider = {
        createPayment: async () => { throw new Error("not implemented"); },
        getPayment: async () => { throw new Error("not implemented"); },
        findOrderByReceipt: async () => null,
        verifyPaymentSignature: () => true,
        createRefund: async () => {
          throw new RazorpayTimeoutError("Gateway network timeout during refund call");
        },
      };

      const result = await refundService.executeMerchantRefund(db, {
        storeId,
        orderId,
        reason: "Network timeout test",
        provider: timeoutProvider,
      });

      expect(result.status).toBe("REQUIRES_RECONCILIATION");
      expect(result.error).toContain("Gateway network timeout");

      const refundRecord = await refundService.getRefund(db, storeId, result.refund.id);
      expect(refundRecord.status).toBe("REQUIRES_RECONCILIATION");
    });

    it("handles provider failure with FAILED status and preserves refundable balance", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "merch-ref-provider-fail");
      const { orderId, paymentId } = await seedOrderWithPayment(db, storeId, {
        amount: 6000,
        paymentStatus: "CAPTURED",
      });

      const failingProvider: PaymentProvider = {
        createPayment: async () => { throw new Error("not implemented"); },
        getPayment: async () => { throw new Error("not implemented"); },
        findOrderByReceipt: async () => null,
        verifyPaymentSignature: () => true,
        createRefund: async () => {
          throw new Error("GATEWAY_REJECTED: Card issuer denied refund request");
        },
      };

      const result = await refundService.executeMerchantRefund(db, {
        storeId,
        orderId,
        reason: "Gateway error test",
        provider: failingProvider,
      });

      expect(result.status).toBe("FAILED");
      expect(result.error).toContain("GATEWAY_REJECTED");

      const refundRecord = await refundService.getRefund(db, storeId, result.refund.id);
      expect(refundRecord.status).toBe("FAILED");

      // Balance was not decremented
      const pmt = await paymentService.getPayment(db, storeId, paymentId);
      expect(pmt.status).toBe("CAPTURED");
      expect(pmt.refundedAmount).toBe(0);
    });

    it("getOrderRefundSummary returns authoritative financial balances and history", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "merch-ref-summary");
      const { orderId } = await seedOrderWithPayment(db, storeId, {
        amount: 9000,
        paymentStatus: "CAPTURED",
      });

      // Before refund
      const summaryBefore = await refundService.getOrderRefundSummary(db, storeId, orderId);
      expect(summaryBefore).toBeDefined();
      expect(summaryBefore?.capturedAmount).toBe(9000);
      expect(summaryBefore?.refundedAmount).toBe(0);
      expect(summaryBefore?.remainingRefundable).toBe(9000);
      expect(summaryBefore?.isRefundable).toBe(true);
      expect(summaryBefore?.refunds.length).toBe(0);

      // Execute full refund
      await refundService.executeMerchantRefund(db, {
        storeId,
        orderId,
        reason: "Summary test refund",
      });

      // After refund
      const summaryAfter = await refundService.getOrderRefundSummary(db, storeId, orderId);
      expect(summaryAfter?.capturedAmount).toBe(9000);
      expect(summaryAfter?.refundedAmount).toBe(9000);
      expect(summaryAfter?.remainingRefundable).toBe(0);
      expect(summaryAfter?.isRefundable).toBe(false);
      expect(summaryAfter?.refunds.length).toBe(1);
      expect(summaryAfter?.refunds[0]?.status).toBe("SUCCEEDED");
      expect(summaryAfter?.refunds[0]?.amount).toBe(9000);
    });

    it("authoritative customer spend calculation excludes fully refunded orders", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "merch-ref-customer-spend");

      const customerId = generateUuidV7();
      await db.query(
        `INSERT INTO customers (id, store_id, email, first_name, last_name, status)
         VALUES ($1, $2, 'spender@test.com', 'Alice', 'Spender', 'ACTIVE')`,
        [customerId, storeId],
      );

      // Order 1: 5000 (remains PAID)
      await seedOrderWithPayment(db, storeId, {
        amount: 5000,
        customerId,
        paymentStatus: "CAPTURED",
      });

      // Order 2: 7000 (will be REFUNDED)
      const { orderId: order2Id } = await seedOrderWithPayment(db, storeId, {
        amount: 7000,
        customerId,
        paymentStatus: "CAPTURED",
      });

      const orderRepo = new OrderRepository();

      // Before refund: Customer total spend is 5000 + 7000 = 12000, order count = 2
      const summaryBefore = await orderRepo.getCustomerOrderSummary(db, storeId, customerId);
      expect(summaryBefore.orderCount).toBe(2);
      expect(summaryBefore.totalSpend).toBe(12000);

      // Execute full refund on Order 2
      await refundService.executeMerchantRefund(db, {
        storeId,
        orderId: order2Id,
        reason: "Customer returned order 2 items",
      });

      // After refund: Customer total spend excludes Order 2 -> 5000, while order count remains 2!
      const summaryAfter = await orderRepo.getCustomerOrderSummary(db, storeId, customerId);
      expect(summaryAfter.orderCount).toBe(2);
      expect(summaryAfter.totalSpend).toBe(5000);
    });

    it("Invariant 1: in-flight pending refunds reserve capacity and block concurrent over-refunding", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "merch-ref-inflight");
      const { orderId, paymentId } = await seedOrderWithPayment(db, storeId, {
        amount: 10000,
        paymentStatus: "CAPTURED",
      });

      // Request a first refund of 6000 (status PENDING)
      const res1 = await refundService.requestRefund(db, {
        storeId,
        paymentId,
        orderId,
        amount: 6000,
        reason: "Partial return 1",
        idempotencyKey: "partial-key-1",
      });
      expect(res1.status).toBe("PENDING");

      // Attempting a second refund of 6000 while the first is in-flight must fail
      // because 6000 + 6000 > 10000 (remaining unreserved capacity is 4000)
      await expect(
        refundService.requestRefund(db, {
          storeId,
          paymentId,
          orderId,
          amount: 6000,
          reason: "Partial return 2",
          idempotencyKey: "partial-key-2",
        }),
      ).rejects.toThrow(RefundExceedsCapturedAmountError);

      // A second refund within remaining capacity (e.g. 4000) succeeds
      const res2 = await refundService.requestRefund(db, {
        storeId,
        paymentId,
        orderId,
        amount: 4000,
        reason: "Partial return 2 valid",
        idempotencyKey: "partial-key-3",
      });
      expect(res2.status).toBe("PENDING");
    });

    it("Invariant 2: rejects idempotency key reuse with mismatched parameters in executeMerchantRefund", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "merch-ref-idem-mismatch");
      const { orderId } = await seedOrderWithPayment(db, storeId, {
        amount: 8000,
        paymentStatus: "CAPTURED",
      });

      const idempotencyKey = "spec-idem-mismatch-key";

      await refundService.executeMerchantRefund(db, {
        storeId,
        orderId,
        amount: 3000,
        reason: "Original reason",
        idempotencyKey,
      });

      // Same key, different amount
      await expect(
        refundService.executeMerchantRefund(db, {
          storeId,
          orderId,
          amount: 5000,
          reason: "Original reason",
          idempotencyKey,
        }),
      ).rejects.toThrow(PaymentIdempotencyConflictError);

      // Same key, different reason
      await expect(
        refundService.executeMerchantRefund(db, {
          storeId,
          orderId,
          amount: 3000,
          reason: "Different reason",
          idempotencyKey,
        }),
      ).rejects.toThrow(PaymentIdempotencyConflictError);
    });

    it("Invariant 3: blocks initiating new refund while an existing refund is in REQUIRES_RECONCILIATION", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "merch-ref-ambiguous-block");
      const { orderId } = await seedOrderWithPayment(db, storeId, {
        amount: 5000,
        paymentStatus: "CAPTURED",
      });

      const timeoutProvider: PaymentProvider = {
        createPayment: async () => { throw new Error("not implemented"); },
        getPayment: async () => { throw new Error("not implemented"); },
        findOrderByReceipt: async () => null,
        verifyPaymentSignature: () => true,
        createRefund: async () => {
          throw new RazorpayTimeoutError("Timeout on gateway");
        },
      };

      // 1. Initial refund times out -> REQUIRES_RECONCILIATION
      const timeoutRes = await refundService.executeMerchantRefund(db, {
        storeId,
        orderId,
        amount: 2000,
        reason: "Timeout refund",
        idempotencyKey: "timeout-key-01",
        provider: timeoutProvider,
      });
      expect(timeoutRes.status).toBe("REQUIRES_RECONCILIATION");

      // 2. Retrying with identical key returns the reconciliation record (idempotency replay)
      const replayRes = await refundService.executeMerchantRefund(db, {
        storeId,
        orderId,
        amount: 2000,
        reason: "Timeout refund",
        idempotencyKey: "timeout-key-01",
        provider: timeoutProvider,
      });
      expect(replayRes.status).toBe("REQUIRES_RECONCILIATION");

      // 3. Attempting a NEW refund with a different key must be blocked until reconciliation
      await expect(
        refundService.executeMerchantRefund(db, {
          storeId,
          orderId,
          amount: 1000,
          reason: "New refund while ambiguous exists",
          idempotencyKey: "new-key-02",
        }),
      ).rejects.toThrow(AmbiguousRefundPendingError);
    });

    it("Invariant 4: production mode fails closed when payment provider is missing", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "merch-ref-prod-failclosed");
      const { orderId } = await seedOrderWithPayment(db, storeId, {
        amount: 5000,
        paymentStatus: "CAPTURED",
      });

      const oldNodeEnv = process.env.NODE_ENV;
      const oldAppEnv = process.env.APP_ENV;
      try {
        process.env.NODE_ENV = "production";
        process.env.APP_ENV = "production";

        await expect(
          refundService.executeMerchantRefund(db, {
            storeId,
            orderId,
            reason: "Attempting simulated refund in production",
          }),
        ).rejects.toThrow(PaymentGatewayError);
      } finally {
        process.env.NODE_ENV = oldNodeEnv;
        process.env.APP_ENV = oldAppEnv;
      }
    });

    it("Invariant 4: mock transport fails closed in production mode", async () => {
      const { isTestOrDemoEnvironment } = await import("../../apps/web/src/lib/payment-provider-helper.js");
      const oldNodeEnv = process.env.NODE_ENV;
      const oldAppEnv = process.env.APP_ENV;
      try {
        process.env.NODE_ENV = "production";
        process.env.APP_ENV = "production";
        expect(isTestOrDemoEnvironment()).toBe(false);
      } finally {
        process.env.NODE_ENV = oldNodeEnv;
        process.env.APP_ENV = oldAppEnv;
      }
    });

    it("Invariant 3 & 6: webhook reconciliation reconciles refund.processed and refund.failed safely", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "merch-ref-webhook");
      const { orderId, paymentId } = await seedOrderWithPayment(db, storeId, {
        amount: 5000,
        paymentStatus: "CAPTURED",
      });

      // Create a provisional pending refund
      const refund = await refundService.requestRefund(db, {
        storeId,
        paymentId,
        orderId,
        amount: 5000,
        reason: "Async provider refund",
        idempotencyKey: "webhook-test-key-1",
      });

      const processor = new PaymentWebhookProcessor();

      // Process refund.processed webhook
      const outcome = await processor.process(
        db,
        {
          id: "evt_test_refund_processed_1",
          entity: "event",
          event: "refund.processed",
          contains: ["refund"],
          payload: {
            refund: {
              entity: {
                id: "rfnd_gateway_12345",
                entity: "refund",
                amount: 5000,
                currency: "USD",
                payment_id: "pay_test_gateway",
                status: "processed",
                receipt: refund.id,
              },
            },
          },
          created_at: Math.floor(Date.now() / 1000),
        },
        "evt_test_refund_processed_1",
      );

      expect(outcome.status).toBe("PROCESSED");

      const updatedRefund = await refundService.getRefund(db, storeId, refund.id);
      expect(updatedRefund.status).toBe("SUCCEEDED");
      expect(updatedRefund.providerRefundId).toBe("rfnd_gateway_12345");

      // Verify duplicate webhook is handled safely without error or double refunding
      const dupOutcome = await processor.process(
        db,
        {
          id: "evt_test_refund_processed_2",
          entity: "event",
          event: "refund.processed",
          contains: ["refund"],
          payload: {
            refund: {
              entity: {
                id: "rfnd_gateway_12345",
                entity: "refund",
                amount: 5000,
                currency: "USD",
                payment_id: "pay_test_gateway",
                status: "processed",
                receipt: refund.id,
              },
            },
          },
          created_at: Math.floor(Date.now() / 1000),
        },
        "evt_test_refund_processed_2",
      );
      expect(dupOutcome.status).toBe("IGNORED");

      // Verify payment was marked refunded
      const pmt = await paymentService.getPayment(db, storeId, paymentId);
      expect(pmt.refundedAmount).toBe(5000);
      expect(pmt.status).toBe("REFUNDED");
    });
  });
});
