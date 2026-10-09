import { createHmac, timingSafeEqual } from "node:crypto";

export const RAZORPAY_WEBHOOK_SIGNATURE_HEADER = "x-razorpay-signature";
export const RAZORPAY_WEBHOOK_EVENT_ID_HEADER = "x-razorpay-event-id";

export interface VerifyRazorpayWebhookSignatureInput {
  rawBody: string | Buffer;
  signature: string;
  webhookSecret: string;
}

/**
 * Verifies a Razorpay webhook signature using HMAC-SHA256 and constant-time comparison.
 *
 * Requirements:
 * - Uses the configured webhook secret (NOT the API Key Secret).
 * - Verifies the exact raw HTTP request body bytes before JSON parsing.
 * - Compares digest using timingSafeEqual to prevent timing attacks.
 * - Rejects missing, malformed, or empty inputs safely.
 */
export function verifyRazorpayWebhookSignature(
  input: VerifyRazorpayWebhookSignatureInput,
): boolean {
  if (!input) {
    return false;
  }

  const { rawBody, signature, webhookSecret } = input;

  if (
    typeof webhookSecret !== "string" ||
    !webhookSecret.trim() ||
    typeof signature !== "string" ||
    !signature.trim() ||
    rawBody === undefined ||
    rawBody === null
  ) {
    return false;
  }

  // Reject empty string or empty buffer body
  if (
    (typeof rawBody === "string" && rawBody.length === 0) ||
    (Buffer.isBuffer(rawBody) && rawBody.length === 0)
  ) {
    return false;
  }

  try {
    const trimmedSecret = webhookSecret.trim();
    const expectedHex = createHmac("sha256", trimmedSecret)
      .update(rawBody)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedHex, "utf8");
    const actualBuffer = Buffer.from(signature.trim().toLowerCase(), "utf8");

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}
