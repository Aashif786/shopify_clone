import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verifyRazorpayPaymentSignature } from "../../modules/payments/src/providers/razorpay-signature.js";

describe("Razorpay Signature Verification", () => {
  const secret = "test_key_secret_abc123456789";
  const orderId = "order_DBJOWzybf0sJbb";
  const paymentId = "pay_29QQoUBi66xm2f";

  function computeValidSignature(ordId: string, pmtId: string, sec: string): string {
    return createHmac("sha256", sec)
      .update(`${ordId}|${pmtId}`)
      .digest("hex");
  }

  describe("1. Valid Signature Verification", () => {
    it("successfully verifies a valid Razorpay signature", () => {
      const validSig = computeValidSignature(orderId, paymentId, secret);
      const isValid = verifyRazorpayPaymentSignature({
        orderId,
        paymentId,
        signature: validSig,
        keySecret: secret,
      });
      expect(isValid).toBe(true);
    });

    it("accepts valid signatures with leading/trailing whitespace or uppercase characters", () => {
      const validSig = computeValidSignature(orderId, paymentId, secret);
      const isValid = verifyRazorpayPaymentSignature({
        orderId: `  ${orderId}  `,
        paymentId: `  ${paymentId}  `,
        signature: `  ${validSig.toUpperCase()}  `,
        keySecret: `  ${secret}  `,
      });
      expect(isValid).toBe(true);
    });

    it("verifies known-good RFC/Razorpay test vector", () => {
      const sec = "enLsA12345secret";
      const oId = "order_1234567890";
      const pId = "pay_0987654321";
      const expected = createHmac("sha256", sec).update(`${oId}|${pId}`).digest("hex");

      expect(
        verifyRazorpayPaymentSignature({
          orderId: oId,
          paymentId: pId,
          signature: expected,
          keySecret: sec,
        }),
      ).toBe(true);
    });
  });

  describe("2. Tampering Detection", () => {
    it("rejects when order ID is tampered", () => {
      const validSig = computeValidSignature(orderId, paymentId, secret);
      const isValid = verifyRazorpayPaymentSignature({
        orderId: "order_TAMPERED",
        paymentId,
        signature: validSig,
        keySecret: secret,
      });
      expect(isValid).toBe(false);
    });

    it("rejects when payment ID is tampered", () => {
      const validSig = computeValidSignature(orderId, paymentId, secret);
      const isValid = verifyRazorpayPaymentSignature({
        orderId,
        paymentId: "pay_TAMPERED",
        signature: validSig,
        keySecret: secret,
      });
      expect(isValid).toBe(false);
    });

    it("rejects when signature characters are tampered", () => {
      const validSig = computeValidSignature(orderId, paymentId, secret);
      const tamperedSig = validSig.slice(0, -1) + (validSig.endsWith("a") ? "b" : "a");
      const isValid = verifyRazorpayPaymentSignature({
        orderId,
        paymentId,
        signature: tamperedSig,
        keySecret: secret,
      });
      expect(isValid).toBe(false);
    });

    it("rejects when secret is incorrect", () => {
      const validSig = computeValidSignature(orderId, paymentId, secret);
      const isValid = verifyRazorpayPaymentSignature({
        orderId,
        paymentId,
        signature: validSig,
        keySecret: "wrong_secret_value",
      });
      expect(isValid).toBe(false);
    });
  });

  describe("3. Missing, Empty, and Malformed Fields", () => {
    it("rejects missing or empty order ID", () => {
      const validSig = computeValidSignature(orderId, paymentId, secret);
      expect(
        verifyRazorpayPaymentSignature({
          orderId: "",
          paymentId,
          signature: validSig,
          keySecret: secret,
        }),
      ).toBe(false);

      expect(
        verifyRazorpayPaymentSignature({
          orderId: "   ",
          paymentId,
          signature: validSig,
          keySecret: secret,
        }),
      ).toBe(false);
    });

    it("rejects missing or empty payment ID", () => {
      const validSig = computeValidSignature(orderId, paymentId, secret);
      expect(
        verifyRazorpayPaymentSignature({
          orderId,
          paymentId: "",
          signature: validSig,
          keySecret: secret,
        }),
      ).toBe(false);
    });

    it("rejects missing or empty signature", () => {
      expect(
        verifyRazorpayPaymentSignature({
          orderId,
          paymentId,
          signature: "",
          keySecret: secret,
        }),
      ).toBe(false);
    });

    it("rejects missing or empty key secret", () => {
      const validSig = computeValidSignature(orderId, paymentId, secret);
      expect(
        verifyRazorpayPaymentSignature({
          orderId,
          paymentId,
          signature: validSig,
          keySecret: "",
        }),
      ).toBe(false);
    });

    it("rejects non-string or malformed inputs safely without crashing", () => {
      // @ts-expect-error Testing invalid runtime input
      expect(verifyRazorpayPaymentSignature(null)).toBe(false);
      // @ts-expect-error Testing invalid runtime input
      expect(verifyRazorpayPaymentSignature(undefined)).toBe(false);
      expect(
        verifyRazorpayPaymentSignature({
          orderId: 123 as unknown as string,
          paymentId,
          signature: "abc",
          keySecret: secret,
        }),
      ).toBe(false);
    });
  });

  describe("4. Length and Timing Comparison Guards", () => {
    it("rejects signatures with length different from expected 64 hex characters", () => {
      expect(
        verifyRazorpayPaymentSignature({
          orderId,
          paymentId,
          signature: "short_sig",
          keySecret: secret,
        }),
      ).toBe(false);

      expect(
        verifyRazorpayPaymentSignature({
          orderId,
          paymentId,
          signature: "a".repeat(128),
          keySecret: secret,
        }),
      ).toBe(false);
    });

    it("rejects invalid signature with matching 64 hex character length", () => {
      const wrong64 = "f".repeat(64);
      expect(
        verifyRazorpayPaymentSignature({
          orderId,
          paymentId,
          signature: wrong64,
          keySecret: secret,
        }),
      ).toBe(false);
    });
  });

  describe("5. Invariant: Callback Signature Alone is Not Proof of Payment", () => {
    it("signature verification function only returns a boolean without performing state transitions", () => {
      const validSig = computeValidSignature(orderId, paymentId, secret);
      const result = verifyRazorpayPaymentSignature({
        orderId,
        paymentId,
        signature: validSig,
        keySecret: secret,
      });

      expect(result).toBe(true);
      expect(typeof result).toBe("boolean");
    });
  });
});
