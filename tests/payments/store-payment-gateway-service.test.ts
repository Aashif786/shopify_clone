import { describe, it, expect, vi } from "vitest";
import {
  StorePaymentGatewayService,
  maskSecret,
} from "../../modules/payments/src/application/store-payment-gateway-service.js";
import type { DatabaseClient, StorePaymentGatewayRepository } from "@calcart/db";

describe("Merchant-Wise Razorpay Gateway Service", () => {
  it("correctly masks secrets", () => {
    expect(maskSecret(null)).toBeNull();
    expect(maskSecret("")).toBeNull();
    expect(maskSecret("1234")).toBe("••••");
    expect(maskSecret("secretKey1234")).toBe("••••••••1234");
  });

  it("returns NOT_CONFIGURED when store has no payment gateway record", async () => {
    const mockRepo = {
      findByStoreAndProvider: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    };
    const service = new StorePaymentGatewayService(mockRepo as unknown as StorePaymentGatewayRepository);
    const mockDb = {} as unknown as DatabaseClient;

    const config = await service.getStoreRazorpayConfig(mockDb, "store-123");
    expect(config.status).toBe("NOT_CONFIGURED");
    expect(config.isConfigured).toBe(false);
    expect(config.isEnabled).toBe(false);
    expect(config.keyId).toBeNull();
  });

  it("returns TEST_MODE when configured with rzp_test keys and enabled", async () => {
    const mockRepo = {
      findByStoreAndProvider: vi.fn().mockResolvedValue({
        id: "gw-1",
        store_id: "store-123",
        provider: "RAZORPAY",
        key_id: "rzp_test_abcdef123456",
        key_secret: "secret9876543210",
        webhook_secret: "wh_secret_1234",
        is_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      }),
      upsert: vi.fn(),
    };
    const service = new StorePaymentGatewayService(mockRepo as unknown as StorePaymentGatewayRepository);
    const mockDb = {} as unknown as DatabaseClient;

    const config = await service.getStoreRazorpayConfig(mockDb, "store-123");
    expect(config.status).toBe("TEST_MODE");
    expect(config.isConfigured).toBe(true);
    expect(config.isEnabled).toBe(true);
    expect(config.hasKeySecret).toBe(true);
    expect(config.keySecretMasked).toBe("••••••••3210");
    expect(config.hasWebhookSecret).toBe(true);
    expect(config.webhookSecretMasked).toBe("••••••••1234");
  });

  it("returns ACTIVE when configured with rzp_live keys and enabled", async () => {
    const mockRepo = {
      findByStoreAndProvider: vi.fn().mockResolvedValue({
        id: "gw-1",
        store_id: "store-123",
        provider: "RAZORPAY",
        key_id: "rzp_live_abcdef123456",
        key_secret: "secret9876543210",
        webhook_secret: null,
        is_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      }),
      upsert: vi.fn(),
    };
    const service = new StorePaymentGatewayService(mockRepo as unknown as StorePaymentGatewayRepository);
    const mockDb = {} as unknown as DatabaseClient;

    const config = await service.getStoreRazorpayConfig(mockDb, "store-123");
    expect(config.status).toBe("ACTIVE");
    expect(config.isConfigured).toBe(true);
    expect(config.isEnabled).toBe(true);
  });

  it("returns INACTIVE when configured but is_enabled is false", async () => {
    const mockRepo = {
      findByStoreAndProvider: vi.fn().mockResolvedValue({
        id: "gw-1",
        store_id: "store-123",
        provider: "RAZORPAY",
        key_id: "rzp_live_abcdef123456",
        key_secret: "secret9876543210",
        webhook_secret: null,
        is_enabled: false,
        created_at: new Date(),
        updated_at: new Date(),
      }),
      upsert: vi.fn(),
    };
    const service = new StorePaymentGatewayService(mockRepo as unknown as StorePaymentGatewayRepository);
    const mockDb = {} as unknown as DatabaseClient;

    const config = await service.getStoreRazorpayConfig(mockDb, "store-123");
    expect(config.status).toBe("INACTIVE");
    expect(config.isConfigured).toBe(true);
    expect(config.isEnabled).toBe(false);
  });
});
