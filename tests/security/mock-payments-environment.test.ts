import { afterEach, describe, expect, it } from "vitest";
import {
  isMockPaymentTransportEnabled,
  isProductionEnvironment,
  isSimulatedRefundSuccessAllowed,
  isTestOrDemoEnvironment,
} from "@calcart/payments";
import { getRazorpayProvider } from "../../apps/web/src/lib/payment-provider-helper.js";

const ENV_KEYS = ["NODE_ENV", "APP_ENV", "MOCK_PAYMENTS", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] as const;

function snapshotEnv(): Map<(typeof ENV_KEYS)[number], string | undefined> {
  return new Map(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(saved: Map<(typeof ENV_KEYS)[number], string | undefined>): void {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("mock payment environment policy", () => {
  const saved: Array<Map<(typeof ENV_KEYS)[number], string | undefined>> = [];

  afterEach(() => {
    while (saved.length > 0) {
      const previous = saved.pop();
      if (previous) restoreEnv(previous);
    }
  });

  function useEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>): void {
    saved.push(snapshotEnv());
    for (const key of ENV_KEYS) {
      if (!(key in values)) continue;
      const value = values[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  it("disables mock payments when NODE_ENV is production even if MOCK_PAYMENTS is true", () => {
    useEnv({ NODE_ENV: "production", APP_ENV: undefined, MOCK_PAYMENTS: "true" });
    expect(isMockPaymentTransportEnabled()).toBe(false);
    expect(isSimulatedRefundSuccessAllowed()).toBe(false);
    expect(isTestOrDemoEnvironment()).toBe(false);
  });

  it("disables mock payments when APP_ENV is production even if MOCK_PAYMENTS is true", () => {
    useEnv({ NODE_ENV: "development", APP_ENV: "production", MOCK_PAYMENTS: "true" });
    expect(isProductionEnvironment()).toBe(true);
    expect(isMockPaymentTransportEnabled()).toBe(false);
    expect(isSimulatedRefundSuccessAllowed()).toBe(false);
  });

  it("disables mock payments in staging even if MOCK_PAYMENTS is true", () => {
    useEnv({ NODE_ENV: "production", APP_ENV: "staging", MOCK_PAYMENTS: "true" });
    expect(isProductionEnvironment()).toBe(false);
    expect(isMockPaymentTransportEnabled()).toBe(false);
    expect(isSimulatedRefundSuccessAllowed()).toBe(false);
    expect(isTestOrDemoEnvironment()).toBe(false);
  });

  it("does not let APP_ENV=demo override NODE_ENV=production", () => {
    useEnv({ NODE_ENV: "production", APP_ENV: "demo", MOCK_PAYMENTS: "true" });
    expect(isProductionEnvironment()).toBe(true);
    expect(isTestOrDemoEnvironment()).toBe(false);
    expect(isMockPaymentTransportEnabled()).toBe(false);
    expect(isSimulatedRefundSuccessAllowed()).toBe(false);
  });

  it("keeps automated test mock transport and explicit demo simulation", () => {
    useEnv({ NODE_ENV: "test", APP_ENV: "development", MOCK_PAYMENTS: undefined });
    expect(isMockPaymentTransportEnabled()).toBe(true);
    expect(isSimulatedRefundSuccessAllowed()).toBe(true);
    expect(isTestOrDemoEnvironment()).toBe(true);

  });

  it("keeps explicit demo simulation outside production and staging", () => {
    useEnv({ NODE_ENV: "development", APP_ENV: "demo", MOCK_PAYMENTS: undefined });
    expect(isProductionEnvironment()).toBe(false);
    expect(isTestOrDemoEnvironment()).toBe(true);
    expect(isSimulatedRefundSuccessAllowed()).toBe(true);
  });

  it("still fabricates order ids for automated tests", async () => {
    useEnv({
      NODE_ENV: "test",
      APP_ENV: "development",
      MOCK_PAYMENTS: undefined,
      RAZORPAY_KEY_ID: "rzp_test_automatedkey12345",
      RAZORPAY_KEY_SECRET: "automated_secret_value_ok",
    });
    const provider = getRazorpayProvider();
    const order = await provider.createOrder({
      paymentId: "pay_test",
      attemptId: "attempt_test",
      storeId: "store_test",
      amount: 900,
      currency: "USD",
      receipt: "receipt-test",
    });
    expect(order.providerOrderId.startsWith("order_mock_")).toBe(true);
  });

  it("does not fabricate a Razorpay order id in production when MOCK_PAYMENTS is true", async () => {
    useEnv({
      NODE_ENV: "production",
      APP_ENV: "production",
      MOCK_PAYMENTS: "true",
      RAZORPAY_KEY_ID: "rzp_live_calcartkey123456",
      RAZORPAY_KEY_SECRET: "live_secret_value_without_banned_words",
    });
    const originalFetch = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = async (input) => {
      urls.push(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
      return new Response(
        JSON.stringify({
          id: "order_live_from_gateway",
          entity: "order",
          amount: 1500,
          currency: "USD",
          status: "created",
          attempts: 0,
          created_at: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    try {
      const provider = getRazorpayProvider();
      const order = await provider.createOrder({
        paymentId: "pay_1",
        attemptId: "attempt_1",
        storeId: "store_1",
        amount: 1500,
        currency: "USD",
        receipt: "receipt-1",
      });
      expect(order.providerOrderId).toBe("order_live_from_gateway");
      expect(order.providerOrderId.startsWith("order_mock_")).toBe(false);
      expect(urls.some((url) => url.includes("/orders"))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
