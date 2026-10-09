import { createHmac, timingSafeEqual } from "node:crypto";

export interface VerifyRazorpaySignatureInput {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}

export function verifyRazorpayPaymentSignature(input: VerifyRazorpaySignatureInput): boolean {
  if (!input) {
    return false;
  }
  if (
    !input.orderId ||
    typeof input.orderId !== "string" ||
    !input.orderId.trim() ||
    !input.paymentId ||
    typeof input.paymentId !== "string" ||
    !input.paymentId.trim() ||
    !input.signature ||
    typeof input.signature !== "string" ||
    !input.signature.trim() ||
    !input.keySecret ||
    typeof input.keySecret !== "string" ||
    !input.keySecret.trim()
  ) {
    return false;
  }

  const payload = `${input.orderId.trim()}|${input.paymentId.trim()}`;
  const expectedHex = createHmac("sha256", input.keySecret.trim())
    .update(payload)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedHex, "utf8");
  const actualBuffer = Buffer.from(input.signature.trim().toLowerCase(), "utf8");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
