import { RazorpayClient, RazorpayPaymentProvider } from "@shopify-clone/payments";
import { ApiHttpError } from "./api";

/**
 * Constructs RazorpayPaymentProvider with strict fail-closed credentials validation.
 * Never silently substitutes placeholder credentials.
 */
export function getRazorpayProvider(): RazorpayPaymentProvider {
  const keyId =
    process.env.RAZORPAY_KEY_ID?.trim() ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!keyId || !keySecret) {
    throw new ApiHttpError(
      500,
      "PAYMENT_GATEWAY_NOT_CONFIGURED",
      "Payment gateway is not properly configured. Missing required Razorpay credentials.",
    );
  }

  const client = new RazorpayClient({ keyId, keySecret });
  return new RazorpayPaymentProvider({ keyId, keySecret, client });
}
