import { describe, expect, it } from "vitest";
import {
  RazorpayApiError,
  RazorpayAuthenticationError,
  RazorpayNetworkError,
  RazorpayRateLimitError,
  RazorpayServerError,
  RazorpayTimeoutError,
} from "../../modules/payments/src/index.js";
import { mapRazorpayError } from "../../apps/web/src/lib/api/payment-provider-errors";
import { handleApiError } from "../../apps/web/src/lib/api/errors";

/**
 * Bug F: a gateway rejection used to fall through handleApiError to a generic
 * 500 "An unexpected error occurred", hiding the real reason. Provider failures must
 * map to safe, useful responses that never echo secrets or raw provider payloads.
 */
describe("Razorpay provider error mapping", () => {
  it("surfaces the gateway's reason for a rejected request as a 400", () => {
    const error = new RazorpayApiError("BAD_REQUEST_ERROR", 400, "BAD_REQUEST_ERROR", {
      code: "BAD_REQUEST_ERROR",
      description: "Order amount less than minimum amount allowed",
    });
    expect(mapRazorpayError(error)).toEqual({
      status: 400,
      code: "PAYMENT_PROVIDER_REJECTED",
      message:
        "The payment gateway rejected this payment request: Order amount less than minimum amount allowed",
    });
  });

  it("strips control characters and bounds the length of the provider description", () => {
    const hostile = `bad\u0000\u001b[31m ${"x".repeat(500)}`;
    const mapped = mapRazorpayError(new RazorpayApiError("m", 400, "C", { description: hostile }));
    expect([...mapped!.message].every((ch) => ch.charCodeAt(0) >= 0x20)).toBe(true);
    expect(mapped!.message.length).toBeLessThan(300);
  });

  it("reports invalid credentials as a configuration problem without detail", () => {
    const mapped = mapRazorpayError(new RazorpayAuthenticationError("Invalid Razorpay API credentials"));
    expect(mapped).toMatchObject({ status: 502, code: "PAYMENT_GATEWAY_NOT_CONFIGURED" });
    expect(mapped!.message).not.toMatch(/rzp_|secret|key/i);
  });

  it.each([
    [new RazorpayRateLimitError(), 429, "PAYMENT_GATEWAY_BUSY"],
    [new RazorpayTimeoutError(), 504, "PAYMENT_GATEWAY_TIMEOUT"],
    [new RazorpayNetworkError(), 502, "PAYMENT_GATEWAY_UNAVAILABLE"],
    [new RazorpayServerError("boom", 500, { description: "internal" }), 502, "PAYMENT_GATEWAY_UNAVAILABLE"],
  ])("maps %o to %i %s", (error, status, code) => {
    expect(mapRazorpayError(error)).toMatchObject({ status, code });
  });

  it("ignores errors that are not from the gateway", () => {
    expect(mapRazorpayError(new Error("boom"))).toBeNull();
    expect(mapRazorpayError("string")).toBeNull();
  });

  it("handleApiError returns the mapped status and code, not a generic 500", async () => {
    const res = handleApiError(
      new RazorpayApiError("m", 400, "BAD_REQUEST_ERROR", {
        description: "The currency is not supported",
      }),
      "req-1",
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("PAYMENT_PROVIDER_REJECTED");
    expect(body.error.message).toContain("The currency is not supported");
  });

  it("does not leak provider details through the response body", async () => {
    const res = handleApiError(
      new RazorpayServerError("upstream said key=rzp_test_SECRET123", 500, {
        description: "key=rzp_test_SECRET123",
      }),
      "req-2",
    );
    const text = await res.text();
    expect(text).not.toContain("rzp_test_SECRET123");
  });
});
