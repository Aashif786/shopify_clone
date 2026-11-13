import {
  RazorpayApiError,
  RazorpayAuthenticationError,
  RazorpayError,
  RazorpayNetworkError,
  RazorpayRateLimitError,
  RazorpayServerError,
  RazorpayTimeoutError,
} from "@calcart/payments";

export interface MappedProviderError {
  status: number;
  code: string;
  message: string;
}

/** Strips anything that is not plain printable text and bounds the length. */
function safeDescription(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^\x20-\x7e]/g, "").trim().slice(0, 200);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Maps a failure from the Razorpay gateway to an HTTP response the storefront can
 * act on. Previously these fell through to a generic 500 "unexpected error", which hid
 * the real reason (unsupported currency, amount below the minimum, bad credentials).
 *
 * Only the gateway's own human-readable description is passed on for a rejected
 * request (a 4xx that the customer's order caused). Credentials, request bodies,
 * signatures and raw provider payloads are never included.
 */
export function mapRazorpayError(error: unknown): MappedProviderError | null {
  if (!(error instanceof RazorpayError)) return null;

  if (error instanceof RazorpayAuthenticationError) {
    // A server-side configuration problem, not something the customer can fix.
    return {
      status: 502,
      code: "PAYMENT_GATEWAY_NOT_CONFIGURED",
      message: "Payment gateway is not properly configured. Please contact the store.",
    };
  }
  if (error instanceof RazorpayRateLimitError) {
    return {
      status: 429,
      code: "PAYMENT_GATEWAY_BUSY",
      message: "The payment gateway is busy. Please try again in a moment.",
    };
  }
  if (error instanceof RazorpayTimeoutError) {
    return {
      status: 504,
      code: "PAYMENT_GATEWAY_TIMEOUT",
      message: "The payment gateway did not respond in time. Please try again.",
    };
  }
  if (error instanceof RazorpayNetworkError || error instanceof RazorpayServerError) {
    return {
      status: 502,
      code: "PAYMENT_GATEWAY_UNAVAILABLE",
      message: "The payment gateway is temporarily unavailable. Please try again.",
    };
  }
  if (error instanceof RazorpayApiError) {
    const details = error.details as { description?: unknown } | undefined;
    const reason = safeDescription(details?.description) ?? safeDescription(error.message);
    return {
      status: 400,
      code: "PAYMENT_PROVIDER_REJECTED",
      message: reason
        ? `The payment gateway rejected this payment request: ${reason}`
        : "The payment gateway rejected this payment request.",
    };
  }
  return {
    status: 502,
    code: "PAYMENT_GATEWAY_ERROR",
    message: "The payment gateway returned an unexpected error.",
  };
}
