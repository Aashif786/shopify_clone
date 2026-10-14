import { describe, expect, it } from "vitest";
import {
  parseJsonBody,
  validateBody,
  createCheckoutValidator,
  storefrontAddCartItemValidator,
  verifyPaymentValidator,
  ApiHttpError,
} from "../../apps/web/src/lib/api/index.js";

describe("Request Validation Security Tests", () => {
  it("rejects malformed JSON with 400", async () => {
    const req = new Request("https://example.com/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"cartId": "123", unclosed: json',
    });

    await expect(parseJsonBody(req)).rejects.toThrow(ApiHttpError);
    try {
      await parseJsonBody(req);
    } catch (err: unknown) {
      if (err instanceof ApiHttpError) {
        expect(err.status).toBe(400);
        expect(err.code).toBe("VALIDATION_ERROR");
        expect(err.message).toContain("Malformed JSON");
      } else {
        throw err;
      }
    }
  });

  it("rejects oversized request bodies exceeding 64KB with 400", async () => {
    const oversizedString = "A".repeat(70_000);
    const body = JSON.stringify({ data: oversizedString });

    const req = new Request("https://example.com/api/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(body.length),
      },
      body,
    });

    await expect(parseJsonBody(req)).rejects.toThrow(ApiHttpError);
    try {
      await parseJsonBody(req);
    } catch (err: unknown) {
      if (err instanceof ApiHttpError) {
        expect(err.status).toBe(400);
        expect(err.code).toBe("VALIDATION_ERROR");
        expect(err.message).toContain("maximum allowed size");
      } else {
        throw err;
      }
    }
  });

  it("rejects arrays when object is expected for mutations", async () => {
    const req = new Request("https://example.com/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([{ variantId: "not-an-object-root" }]),
    });

    await expect(validateBody(req, storefrontAddCartItemValidator)).rejects.toThrow(ApiHttpError);
    try {
      const freshReq = new Request("https://example.com/api/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify([{ variantId: "not-an-object-root" }]),
      });
      await validateBody(freshReq, storefrontAddCartItemValidator);
    } catch (err: unknown) {
      if (err instanceof ApiHttpError) {
        expect(err.status).toBe(400);
        expect(err.code).toBe("VALIDATION_ERROR");
      } else {
        throw err;
      }
    }
  });

  it("rejects invalid quantities (< 1 or > 999 or non-integers)", () => {
    const validUuid = "018d3a77-9a4d-7a6c-941f-cf1234567890";

    const zeroRes = storefrontAddCartItemValidator.validate({
      variantId: validUuid,
      quantity: 0,
    });
    expect(zeroRes.success).toBe(false);

    const negRes = storefrontAddCartItemValidator.validate({
      variantId: validUuid,
      quantity: -5,
    });
    expect(negRes.success).toBe(false);

    const floatRes = storefrontAddCartItemValidator.validate({
      variantId: validUuid,
      quantity: 3.5,
    });
    expect(floatRes.success).toBe(false);

    const hugeRes = storefrontAddCartItemValidator.validate({
      variantId: validUuid,
      quantity: 1000,
    });
    expect(hugeRes.success).toBe(false);

    const validRes = storefrontAddCartItemValidator.validate({
      variantId: validUuid,
      quantity: 5,
    });
    expect(validRes.success).toBe(true);
  });

  it("rejects non-UUID identifiers for cartId, variantId, paymentId", () => {
    const invalidCartRes = createCheckoutValidator.validate({
      cartId: "not-a-uuid-string",
    });
    expect(invalidCartRes.success).toBe(false);

    const invalidPaymentRes = verifyPaymentValidator.validate({
      paymentId: "12345-not-uuid",
      attemptId: "018d3a77-9a4d-7a6c-941f-cf1234567890",
      razorpayPaymentId: "pay_123",
      razorpayOrderId: "order_123",
      razorpaySignature: "sig_123",
    });
    expect(invalidPaymentRes.success).toBe(false);
  });
});
