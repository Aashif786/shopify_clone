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

  const lowerKey = keyId.toLowerCase();
  const lowerSecret = keySecret.toLowerCase();
  if (
    lowerKey.includes("placeholder") ||
    lowerKey.includes("<") ||
    lowerKey.includes("example") ||
    lowerSecret.includes("placeholder") ||
    lowerSecret.includes("<") ||
    lowerSecret.includes("example")
  ) {
    throw new ApiHttpError(
      500,
      "PAYMENT_GATEWAY_NOT_CONFIGURED",
      "Payment gateway is not properly configured. Placeholder credentials cannot be used.",
    );
  }

  const transport = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (urlStr.includes("/payments/pay_mock_")) {
      const match = urlStr.match(/\/payments\/(pay_mock_\d+_(\d+)_([A-Za-z]+)_([^/?]+))/);
      if (match && match[1] && match[2] && match[3] && match[4]) {
        return new Response(
          JSON.stringify({
            id: match[1],
            entity: "payment",
            amount: Number(match[2]),
            currency: match[3].toUpperCase(),
            status: "captured",
            order_id: match[4],
            method: "card",
            captured: true,
            created_at: Math.floor(Date.now() / 1000),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
    }
    return globalThis.fetch(input, init);
  };

  const client = new RazorpayClient({ keyId, keySecret, transport });
  return new RazorpayPaymentProvider({ keyId, keySecret, client });
}
