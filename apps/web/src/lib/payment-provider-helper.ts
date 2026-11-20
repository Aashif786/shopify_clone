import type { Database, DatabaseClient } from "@calcart/db";
import {
  isMockPaymentTransportEnabled,
  isProductionEnvironment,
  isTestOrDemoEnvironment,
  RazorpayClient,
  RazorpayPaymentProvider,
  StorePaymentGatewayService,
} from "@calcart/payments";
import { ApiHttpError } from "./api";

export {
  isMockPaymentTransportEnabled,
  isProductionEnvironment,
  isTestOrDemoEnvironment,
};

const gatewayService = new StorePaymentGatewayService();

function createMockTransport() {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const isTestOrDemo = isTestOrDemoEnvironment();
    const isAutomatedTestOrMock = isMockPaymentTransportEnabled();
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (isTestOrDemo && urlStr.includes("/refund")) {
      const match = urlStr.match(/\/payments\/([^/?]+)\/refund/);
      const paymentId = match && match[1] ? match[1] : "pay_mock";
      if (
        paymentId.startsWith("pay_mock_") ||
        paymentId.startsWith("pay_test_") ||
        isAutomatedTestOrMock
      ) {
        let reqBody: Record<string, unknown> = {};
        try {
          reqBody = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        } catch {
          // ignore
        }
        return new Response(
          JSON.stringify({
            id: `rfnd_mock_${Date.now()}`,
            entity: "refund",
            amount: typeof reqBody.amount === "number" ? reqBody.amount : 1000,
            currency: typeof reqBody.currency === "string" ? reqBody.currency : "INR",
            payment_id: paymentId,
            status: "processed",
            created_at: Math.floor(Date.now() / 1000),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
    }
    if (isAutomatedTestOrMock && (urlStr.endsWith("/orders") || urlStr.includes("/orders"))) {
      let reqBody: Record<string, unknown> = {};
      try {
        reqBody = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      } catch {
        // ignore
      }
      return new Response(
        JSON.stringify({
          id: `order_mock_${Date.now()}`,
          entity: "order",
          amount: typeof reqBody.amount === "number" ? reqBody.amount : 1000,
          currency: typeof reqBody.currency === "string" ? reqBody.currency : "USD",
          receipt: typeof reqBody.receipt === "string" ? reqBody.receipt : undefined,
          status: "created",
          attempts: 0,
          created_at: Math.floor(Date.now() / 1000),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (isTestOrDemo && urlStr.includes("/payments/pay_mock_")) {
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
}

export function validateRazorpayCredentials(keyId: string | undefined, keySecret: string | undefined): { keyId: string; keySecret: string } {
  const trimmedKey = keyId?.trim();
  const trimmedSecret = keySecret?.trim();

  if (!trimmedKey || !trimmedSecret) {
    throw new ApiHttpError(
      500,
      "PAYMENT_GATEWAY_NOT_CONFIGURED",
      "Payment gateway is not properly configured. Missing required Razorpay credentials.",
    );
  }

  const isProduction = isProductionEnvironment();
  if (isProduction && (trimmedKey.startsWith("rzp_test_") || trimmedSecret.startsWith("rzp_test_"))) {
    throw new ApiHttpError(
      500,
      "PAYMENT_GATEWAY_NOT_CONFIGURED",
      "Payment gateway is not properly configured. Razorpay test credentials cannot be used in production.",
    );
  }

  const lowerKey = trimmedKey.toLowerCase();
  const lowerSecret = trimmedSecret.toLowerCase();
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

  return { keyId: trimmedKey, keySecret: trimmedSecret };
}

export function buildRazorpayProvider(keyId: string, keySecret: string): RazorpayPaymentProvider {
  const valid = validateRazorpayCredentials(keyId, keySecret);
  const transport = createMockTransport();
  const client = new RazorpayClient({ keyId: valid.keyId, keySecret: valid.keySecret, transport });
  return new RazorpayPaymentProvider({ keyId: valid.keyId, keySecret: valid.keySecret, client });
}

/**
 * Constructs RazorpayPaymentProvider using global environment variables.
 * Fallback for non-merchant-scoped or legacy workflows.
 */
export function getRazorpayProvider(): RazorpayPaymentProvider {
  const keyId =
    process.env.RAZORPAY_KEY_ID?.trim() ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  return buildRazorpayProvider(keyId ?? "", keySecret ?? "");
}

export function tryGetRazorpayProvider(): RazorpayPaymentProvider | undefined {
  try {
    return getRazorpayProvider();
  } catch {
    return undefined;
  }
}

/**
 * Authoritatively resolves Razorpay payment provider for a specific merchant store.
 * 1. Checks `store_payment_gateways` for the merchant's configured & enabled Razorpay credentials.
 * 2. If configured and enabled, constructs and returns a store-specific RazorpayPaymentProvider.
 * 3. If not configured or not enabled, falls back to environment credentials (if available) for backward compatibility,
 *    or throws a fail-closed PAYMENT_GATEWAY_NOT_CONFIGURED error with merchant-specific context.
 */
export async function getRazorpayProviderForStore(
  clientOrDb: Database | DatabaseClient,
  storeId: string,
): Promise<RazorpayPaymentProvider> {
  if (!storeId) {
    return getRazorpayProvider();
  }

  const storeGateway = await gatewayService.getRawStoreRazorpayRow(clientOrDb, storeId);

  if (storeGateway && storeGateway.is_enabled) {
    const keyId = storeGateway.key_id?.trim();
    const keySecret = storeGateway.key_secret?.trim();

    if (keyId && keySecret) {
      return buildRazorpayProvider(keyId, keySecret);
    }
  }

  // Fallback to environment variables if store has not configured custom credentials
  try {
    return getRazorpayProvider();
  } catch {
    throw new ApiHttpError(
      500,
      "PAYMENT_GATEWAY_NOT_CONFIGURED",
      `Payment gateway is not configured for this store. The merchant must configure active Razorpay API keys in Store Settings > Payment Gateways.`,
    );
  }
}

/**
 * Safe attempt to resolve store-specific Razorpay provider without throwing.
 */
export async function tryGetRazorpayProviderForStore(
  clientOrDb: Database | DatabaseClient,
  storeId: string,
): Promise<RazorpayPaymentProvider | undefined> {
  try {
    return await getRazorpayProviderForStore(clientOrDb, storeId);
  } catch {
    return undefined;
  }
}
