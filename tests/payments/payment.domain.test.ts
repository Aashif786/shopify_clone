import { describe, expect, it } from "vitest";
import { Payment } from "../../modules/payments/src/domain/payment.js";
import { PaymentAttempt } from "../../modules/payments/src/domain/payment-attempt.js";
import {
  CapturedAmountExceedsPaymentAmountError,
  InvalidCurrencyError,
  InvalidMonetaryAmountError,
  InvalidPaymentAttemptStateTransitionError,
  InvalidPaymentStateTransitionError,
  InvalidRefundStateTransitionError,
  PaymentNotRefundableError,
  RefundExceedsCapturedAmountError,
} from "../../modules/payments/src/domain/payment-errors.js";
import {
  assertValidPaymentAttemptTransition,
  assertValidPaymentTransition,
  assertValidRefundTransition,
  isValidPaymentAttemptTransition,
  isValidPaymentTransition,
  isValidRefundTransition,
} from "../../modules/payments/src/domain/payment-state.js";

describe("Payment Domain Model & Invariants", () => {
  const defaultProps = {
    storeId: "store_123",
    checkoutId: "chk_456",
    amount: 10000,
    currency: "USD",
  };

  describe("1. Monetary Amount & Currency Invariants", () => {
    it("creates a payment with valid positive minor units amount", () => {
      const payment = Payment.create(defaultProps);
      expect(payment.amount).toBe(10000);
      expect(payment.currency).toBe("USD");
      expect(payment.status).toBe("CREATED");
      expect(payment.capturedAmount).toBe(0);
      expect(payment.refundedAmount).toBe(0);
    });

    it("rejects zero or negative payment amount", () => {
      expect(() =>
        Payment.create({ ...defaultProps, amount: 0 }),
      ).toThrow(InvalidMonetaryAmountError);

      expect(() =>
        Payment.create({ ...defaultProps, amount: -100 }),
      ).toThrow(InvalidMonetaryAmountError);
    });

    it("rejects non-integer monetary amounts", () => {
      expect(() =>
        Payment.create({ ...defaultProps, amount: 99.99 }),
      ).toThrow(InvalidMonetaryAmountError);
    });

    it("rejects invalid currency formats", () => {
      expect(() =>
        Payment.create({ ...defaultProps, currency: "usd" }),
      ).toThrow(InvalidCurrencyError);

      expect(() =>
        Payment.create({ ...defaultProps, currency: "US" }),
      ).toThrow(InvalidCurrencyError);

      expect(() =>
        Payment.create({ ...defaultProps, currency: "USDT" }),
      ).toThrow(InvalidCurrencyError);
    });

    it("rejects captured_amount exceeding total amount on reconstitution", () => {
      expect(() =>
        Payment.reconstitute({
          id: "pmt_1",
          storeId: "store_1",
          checkoutId: "chk_1",
          amount: 5000,
          currency: "USD",
          status: "CAPTURED",
          provider: "razorpay",
          capturedAmount: 5001,
          refundedAmount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).toThrow(CapturedAmountExceedsPaymentAmountError);
    });

    it("rejects refunded_amount exceeding captured_amount on reconstitution", () => {
      expect(() =>
        Payment.reconstitute({
          id: "pmt_1",
          storeId: "store_1",
          checkoutId: "chk_1",
          amount: 5000,
          currency: "USD",
          status: "CAPTURED",
          provider: "razorpay",
          capturedAmount: 3000,
          refundedAmount: 3001,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).toThrow(RefundExceedsCapturedAmountError);
    });
  });

  describe("2. Canonical Payment State Transitions", () => {
    it("allows standard happy path: CREATED -> PENDING -> AUTHORIZED -> CAPTURED", () => {
      const payment = Payment.create(defaultProps);
      expect(payment.status).toBe("CREATED");

      payment.markPending();
      expect(payment.status).toBe("PENDING");

      payment.markAuthorized();
      expect(payment.status).toBe("AUTHORIZED");

      payment.markCaptured(10000);
      expect(payment.status).toBe("CAPTURED");
      expect(payment.capturedAmount).toBe(10000);
      expect(payment.isCaptured()).toBe(true);
    });

    it("allows direct capture from PENDING or PROCESSING", () => {
      const payment = Payment.create(defaultProps);
      payment.markPending();
      payment.markCaptured();
      expect(payment.status).toBe("CAPTURED");
      expect(payment.capturedAmount).toBe(10000);

      const payment2 = Payment.create(defaultProps);
      payment2.markPending();
      payment2.markProcessing();
      payment2.markCaptured(8000);
      expect(payment2.status).toBe("CAPTURED");
      expect(payment2.capturedAmount).toBe(8000);
    });

    it("allows transitioning to REQUIRES_RECONCILIATION from PENDING, PROCESSING, or AUTHORIZED", () => {
      const payment = Payment.create(defaultProps);
      payment.markPending();
      payment.markRequiresReconciliation();
      expect(payment.status).toBe("REQUIRES_RECONCILIATION");

      // Can be resolved to CAPTURED or FAILED
      payment.markCaptured();
      expect(payment.status).toBe("CAPTURED");
    });

    it("allows idempotent self-transitions without error", () => {
      const payment = Payment.create(defaultProps);
      payment.markPending();
      // Re-asserting same status
      payment.markPending();
      expect(payment.status).toBe("PENDING");
    });

    it("rejects backwards movement from CAPTURED to earlier active states", () => {
      const payment = Payment.create(defaultProps);
      payment.markPending();
      payment.markCaptured();

      expect(() => payment.markPending()).toThrow(InvalidPaymentStateTransitionError);
      expect(() => payment.markProcessing()).toThrow(InvalidPaymentStateTransitionError);
      expect(() => payment.markAuthorized()).toThrow(InvalidPaymentStateTransitionError);
      expect(() => payment.markFailed()).toThrow(InvalidPaymentStateTransitionError);
      expect(() => payment.markCancelled()).toThrow(InvalidPaymentStateTransitionError);
    });

    it("enforces terminal state immutability (FAILED, CANCELLED, REFUNDED)", () => {
      const failedPayment = Payment.create(defaultProps);
      failedPayment.markFailed();
      expect(failedPayment.isTerminal()).toBe(true);
      expect(() => failedPayment.markPending()).toThrow(InvalidPaymentStateTransitionError);
      expect(() => failedPayment.markCaptured()).toThrow(InvalidPaymentStateTransitionError);

      const cancelledPayment = Payment.create(defaultProps);
      cancelledPayment.markCancelled();
      expect(cancelledPayment.isTerminal()).toBe(true);
      expect(() => cancelledPayment.markPending()).toThrow(InvalidPaymentStateTransitionError);
    });
  });

  describe("3. Refund Accounting Invariants", () => {
    it("rejects refunds on uncaptured payments", () => {
      const payment = Payment.create(defaultProps);
      expect(payment.isRefundable()).toBe(false);
      expect(() => payment.recordRefund(1000)).toThrow(PaymentNotRefundableError);

      payment.markPending();
      expect(() => payment.recordRefund(1000)).toThrow(PaymentNotRefundableError);

      payment.markFailed();
      expect(() => payment.recordRefund(1000)).toThrow(PaymentNotRefundableError);
    });

    it("processes partial refunds and transitions to PARTIALLY_REFUNDED", () => {
      const payment = Payment.create(defaultProps);
      payment.markPending();
      payment.markCaptured(10000);

      const result = payment.recordRefund(4000);
      expect(result.isFullRefund).toBe(false);
      expect(result.newStatus).toBe("PARTIALLY_REFUNDED");
      expect(payment.status).toBe("PARTIALLY_REFUNDED");
      expect(payment.refundedAmount).toBe(4000);
      expect(payment.getRemainingRefundableAmount()).toBe(6000);
    });

    it("processes subsequent partial refunds until reaching full refund", () => {
      const payment = Payment.create(defaultProps);
      payment.markPending();
      payment.markCaptured(10000);

      payment.recordRefund(4000);
      const secondRefund = payment.recordRefund(6000);

      expect(secondRefund.isFullRefund).toBe(true);
      expect(secondRefund.newStatus).toBe("REFUNDED");
      expect(payment.status).toBe("REFUNDED");
      expect(payment.refundedAmount).toBe(10000);
      expect(payment.getRemainingRefundableAmount()).toBe(0);
      expect(payment.isTerminal()).toBe(true);
    });

    it("rejects refund amount exceeding remaining refundable balance", () => {
      const payment = Payment.create(defaultProps);
      payment.markPending();
      payment.markCaptured(10000);

      payment.recordRefund(6000);

      // Remaining refundable balance is 4000; attempting 4001 must throw
      expect(() => payment.recordRefund(4001)).toThrow(RefundExceedsCapturedAmountError);
    });
  });

  describe("4. Payment Attempt Domain Model & Invariants", () => {
    it("creates an attempt with frozen amount and currency snapshots", () => {
      const attempt = PaymentAttempt.create({
        paymentId: "pmt_1",
        storeId: "store_1",
        attemptNumber: 1,
        amount: 8500,
        currency: "USD",
        idempotencyKey: "idem_attempt_1",
      });

      expect(attempt.attemptNumber).toBe(1);
      expect(attempt.amount).toBe(8500);
      expect(attempt.currency).toBe("USD");
      expect(attempt.status).toBe("INITIATED");
    });

    it("progresses attempt lifecycle: INITIATED -> PENDING -> CAPTURED", () => {
      const attempt = PaymentAttempt.create({
        paymentId: "pmt_1",
        storeId: "store_1",
        attemptNumber: 1,
        amount: 8500,
        currency: "USD",
      });

      attempt.markPending("order_gateway_1");
      expect(attempt.status).toBe("PENDING");
      expect(attempt.providerOrderId).toBe("order_gateway_1");

      attempt.markCaptured("pay_gateway_1", "sig_gateway_1");
      expect(attempt.status).toBe("CAPTURED");
      expect(attempt.providerPaymentId).toBe("pay_gateway_1");
      expect(attempt.providerSignature).toBe("sig_gateway_1");
    });

    it("rejects invalid attempt transitions", () => {
      const attempt = PaymentAttempt.create({
        paymentId: "pmt_1",
        storeId: "store_1",
        attemptNumber: 1,
        amount: 8500,
        currency: "USD",
      });
      attempt.markPending();
      attempt.markCaptured();

      expect(() => attempt.markPending()).toThrow(InvalidPaymentAttemptStateTransitionError);
      expect(() => attempt.markFailed()).toThrow(InvalidPaymentAttemptStateTransitionError);
    });
  });

  describe("5. State Transition Validator Matrix Assertions", () => {
    it("validates payment transition rules correctly", () => {
      expect(isValidPaymentTransition("CREATED", "PENDING")).toBe(true);
      expect(isValidPaymentTransition("PENDING", "CAPTURED")).toBe(true);
      expect(isValidPaymentTransition("CAPTURED", "REFUNDED")).toBe(true);
      expect(isValidPaymentTransition("CAPTURED", "FAILED")).toBe(false);
      expect(isValidPaymentTransition("FAILED", "PENDING")).toBe(false);
      expect(isValidPaymentTransition("REFUNDED", "PENDING")).toBe(false);

      expect(() => assertValidPaymentTransition("REFUNDED", "CAPTURED")).toThrow(
        InvalidPaymentStateTransitionError,
      );
    });

    it("validates refund transition rules correctly", () => {
      expect(isValidRefundTransition("PENDING", "PROCESSING")).toBe(true);
      expect(isValidRefundTransition("PROCESSING", "SUCCEEDED")).toBe(true);
      expect(isValidRefundTransition("PENDING", "FAILED")).toBe(true);
      expect(isValidRefundTransition("SUCCEEDED", "PENDING")).toBe(false);
      expect(isValidRefundTransition("FAILED", "SUCCEEDED")).toBe(false);

      expect(() => assertValidRefundTransition("SUCCEEDED", "FAILED")).toThrow(
        InvalidRefundStateTransitionError,
      );
    });

    it("validates payment attempt transition rules correctly", () => {
      expect(isValidPaymentAttemptTransition("INITIATED", "PENDING")).toBe(true);
      expect(isValidPaymentAttemptTransition("PENDING", "AUTHORIZED")).toBe(true);
      expect(isValidPaymentAttemptTransition("AUTHORIZED", "CAPTURED")).toBe(true);
      expect(isValidPaymentAttemptTransition("CAPTURED", "INITIATED")).toBe(false);

      expect(() => assertValidPaymentAttemptTransition("CAPTURED", "PENDING")).toThrow(
        InvalidPaymentAttemptStateTransitionError,
      );
    });
  });
});
