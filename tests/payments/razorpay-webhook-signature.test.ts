import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  RAZORPAY_WEBHOOK_EVENT_ID_HEADER,
  RAZORPAY_WEBHOOK_SIGNATURE_HEADER,
  verifyRazorpayWebhookSignature,
} from "../../modules/payments/src/webhooks/razorpay-webhook-signature.js";

describe("Razorpay Webhook Signature Verification", () => {
  const testSecret = "whsec_test_secret_razorpay_987654321";
  const sampleJsonBody = JSON.stringify({
    entity: "event",
    account_id: "acc_123456",
    event: "payment.captured",
    contains: ["payment"],
    payload: {
      payment: {
        entity: {
          id: "pay_test_123",
          amount: 5000,
          currency: "USD",
          status: "captured",
        },
      },
    },
    created_at: 1700000000,
  });

  function computeSignature(body: string | Buffer, secret = testSecret): string {
    return createHmac("sha256", secret).update(body).digest("hex");
  }

  describe("1. Header Constants", () => {
    it("defines the standard Razorpay signature and event ID headers", () => {
      expect(RAZORPAY_WEBHOOK_SIGNATURE_HEADER).toBe("x-razorpay-signature");
      expect(RAZORPAY_WEBHOOK_EVENT_ID_HEADER).toBe("x-razorpay-event-id");
    });
  });

  describe("2. Valid Signature Verification", () => {
    it("successfully verifies a valid webhook signature with string body", () => {
      const signature = computeSignature(sampleJsonBody);
      const isValid = verifyRazorpayWebhookSignature({
        rawBody: sampleJsonBody,
        signature,
        webhookSecret: testSecret,
      });
      expect(isValid).toBe(true);
    });

    it("successfully verifies a valid webhook signature with Buffer body", () => {
      const bufferBody = Buffer.from(sampleJsonBody, "utf8");
      const signature = computeSignature(bufferBody);
      const isValid = verifyRazorpayWebhookSignature({
        rawBody: bufferBody,
        signature,
        webhookSecret: testSecret,
      });
      expect(isValid).toBe(true);
    });

    it("verifies uppercase signature string safely", () => {
      const signature = computeSignature(sampleJsonBody).toUpperCase();
      const isValid = verifyRazorpayWebhookSignature({
        rawBody: sampleJsonBody,
        signature,
        webhookSecret: testSecret,
      });
      expect(isValid).toBe(true);
    });
  });

  describe("3. Tampering and Invalid Signatures", () => {
    it("rejects when raw body is tampered even by a single character or whitespace", () => {
      const signature = computeSignature(sampleJsonBody);
      const tamperedBody = sampleJsonBody + " ";

      const isValid = verifyRazorpayWebhookSignature({
        rawBody: tamperedBody,
        signature,
        webhookSecret: testSecret,
      });
      expect(isValid).toBe(false);
    });

    it("rejects when signature does not match secret", () => {
      const signature = computeSignature(sampleJsonBody, "different_secret_entirely");
      const isValid = verifyRazorpayWebhookSignature({
        rawBody: sampleJsonBody,
        signature,
        webhookSecret: testSecret,
      });
      expect(isValid).toBe(false);
    });

    it("rejects when signature characters are tampered", () => {
      const signature = computeSignature(sampleJsonBody);
      const tamperedSignature =
        signature.slice(0, -1) + (signature.endsWith("0") ? "1" : "0");

      const isValid = verifyRazorpayWebhookSignature({
        rawBody: sampleJsonBody,
        signature: tamperedSignature,
        webhookSecret: testSecret,
      });
      expect(isValid).toBe(false);
    });
  });

  describe("4. Missing, Empty, and Malformed Inputs", () => {
    it("rejects missing or empty signature", () => {
      expect(
        verifyRazorpayWebhookSignature({
          rawBody: sampleJsonBody,
          signature: "",
          webhookSecret: testSecret,
        }),
      ).toBe(false);

      expect(
        verifyRazorpayWebhookSignature({
          rawBody: sampleJsonBody,
          signature: "   ",
          webhookSecret: testSecret,
        }),
      ).toBe(false);
    });

    it("rejects missing or empty webhook secret", () => {
      const signature = computeSignature(sampleJsonBody);
      expect(
        verifyRazorpayWebhookSignature({
          rawBody: sampleJsonBody,
          signature,
          webhookSecret: "",
        }),
      ).toBe(false);

      expect(
        verifyRazorpayWebhookSignature({
          rawBody: sampleJsonBody,
          signature,
          webhookSecret: "   ",
        }),
      ).toBe(false);
    });

    it("rejects empty body", () => {
      const signature = computeSignature("");
      expect(
        verifyRazorpayWebhookSignature({
          rawBody: "",
          signature,
          webhookSecret: testSecret,
        }),
      ).toBe(false);

      expect(
        verifyRazorpayWebhookSignature({
          rawBody: Buffer.alloc(0),
          signature,
          webhookSecret: testSecret,
        }),
      ).toBe(false);
    });

    it("rejects signature with incorrect length", () => {
      expect(
        verifyRazorpayWebhookSignature({
          rawBody: sampleJsonBody,
          signature: "short_hex",
          webhookSecret: testSecret,
        }),
      ).toBe(false);

      expect(
        verifyRazorpayWebhookSignature({
          rawBody: sampleJsonBody,
          signature: "a".repeat(128),
          webhookSecret: testSecret,
        }),
      ).toBe(false);
    });

    it("handles null or undefined input gracefully without throwing", () => {
      // @ts-expect-error testing runtime safety
      expect(verifyRazorpayWebhookSignature(null)).toBe(false);
      // @ts-expect-error testing runtime safety
      expect(verifyRazorpayWebhookSignature(undefined)).toBe(false);
      // @ts-expect-error testing runtime safety
      expect(verifyRazorpayWebhookSignature({})).toBe(false);
    });
  });

  describe("5. Raw Body Preservation Invariant", () => {
    it("proves that parsed and re-stringified JSON breaks signature verification if key order differs", () => {
      // Razorpay calculates HMAC over exact raw bytes
      const rawString = '{"b":2,"a":1}';
      const signature = computeSignature(rawString);

      // Re-serializing parsed object produces '{"b":2,"a":1}' or '{"a":1,"b":2}' depending on key iteration
      const parsed = JSON.parse(rawString);
      const reStringified = JSON.stringify({ a: parsed.a, b: parsed.b });

      // Verifying raw string passes
      expect(
        verifyRazorpayWebhookSignature({
          rawBody: rawString,
          signature,
          webhookSecret: testSecret,
        }),
      ).toBe(true);

      // Verifying altered re-stringified bytes fails
      expect(
        verifyRazorpayWebhookSignature({
          rawBody: reStringified,
          signature,
          webhookSecret: testSecret,
        }),
      ).toBe(false);
    });
  });
});
