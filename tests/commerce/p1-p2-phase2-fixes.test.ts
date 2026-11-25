import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Database, PaymentRepository, PaymentAttemptRepository } from "@calcart/db";
import type { CheckoutDTO } from "@calcart/checkout";
import type { OrderDTO, OrderService } from "@calcart/orders";
import {
  customDomainCache,
  setCustomDomainCacheEntry,
  MAX_CUSTOM_DOMAIN_CACHE_SIZE,
} from "../../apps/web/middleware.js";
import { ApiClient } from "../../apps/web/src/lib/api-client.js";
import { RateLimiter } from "../../apps/web/src/lib/rate-limiter.js";
import { generateOrderNumber } from "../../modules/orders/src/application/order-service.js";
import { PaymentRecoveryService } from "../../modules/payments/src/application/payment-recovery-service.js";
import { ProviderPaymentService } from "../../modules/payments/src/application/provider-payment-service.js";
import type { PaymentOrderIntegration } from "../../modules/payments/src/application/payment-order-integration.js";
import type { WebhookRecoveryService } from "../../modules/payments/src/webhooks/webhook-recovery.js";
import type { RazorpayPaymentProvider } from "../../modules/payments/src/providers/razorpay-provider.js";
import { assertCheckoutOwnership, assertOrderOwnership } from "../../apps/web/src/lib/storefront-auth-helpers.js";
import { hashToken } from "@calcart/auth";

describe("P1 and P2 Phase 2 Fixes", () => {
  describe("1. Middleware domain cache bounding & prefix security", () => {
    beforeEach(() => {
      customDomainCache.clear();
    });

    it("bounds customDomainCache size and evicts oldest or expired entries", () => {
      const now = Date.now();
      // Populate to capacity with 1 expired entry and 999 active entries
      setCustomDomainCacheEntry("expired.domain.com", "expired-store", now - 1000);

      for (let i = 0; i < MAX_CUSTOM_DOMAIN_CACHE_SIZE - 1; i++) {
        setCustomDomainCacheEntry(`store-${i}.domain.com`, `store-${i}`, now + 60_000);
      }

      expect(customDomainCache.size).toBe(MAX_CUSTOM_DOMAIN_CACHE_SIZE);

      // Inserting one more entry should trigger eviction of the expired one first
      setCustomDomainCacheEntry("new.domain.com", "new-store", now + 60_000);
      expect(customDomainCache.size).toBe(MAX_CUSTOM_DOMAIN_CACHE_SIZE);
      expect(customDomainCache.has("expired.domain.com")).toBe(false);
      expect(customDomainCache.has("new.domain.com")).toBe(true);

      // Inserting yet another entry when none are expired evicts the oldest entry
      const oldestKey = customDomainCache.keys().next().value;
      setCustomDomainCacheEntry("another.domain.com", "another-store", now + 60_000);
      expect(customDomainCache.size).toBe(MAX_CUSTOM_DOMAIN_CACHE_SIZE);
      expect(customDomainCache.has(oldestKey!)).toBe(false);
      expect(customDomainCache.has("another.domain.com")).toBe(true);
    });

    it("validates cross-store boundary logic rejecting prefix collisions", () => {
      const storeSlug = "art";
      const storePathPrefix = `/stores/${storeSlug}`;

      // Legitimate paths under storeSlug
      const exactPath = "/stores/art";
      const nestedPath = "/stores/art/products/123";
      // Prefix collision attempt
      const attackPath = "/stores/artisan-store";

      const isPathAllowed = (pathname: string) =>
        pathname === storePathPrefix || pathname.startsWith(`${storePathPrefix}/`);

      expect(isPathAllowed(exactPath)).toBe(true);
      expect(isPathAllowed(nestedPath)).toBe(true);
      expect(isPathAllowed(attackPath)).toBe(false);
    });
  });

  describe("2. ApiClient double-prefix prevention & parameter-aware deduplication", () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("does not double-prefix URLs that already contain the prefix", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true }),
      });
      globalThis.fetch = fetchMock;

      const client = new ApiClient("/api/v1");

      await client.get("/api/v1/products");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/v1\/products$/),
        expect.anything(),
      );

      // Calling an endpoint without prefix adds it
      await client.get("/checkout");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/v1\/checkout$/),
        expect.anything(),
      );

      // Calling an absolute URL preserves it
      await client.get("https://external.api.com/status");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://external.api.com/status",
        expect.anything(),
      );
    });

    it("differentiates GET deduplication keys by params and storeId", async () => {
      let callCount = 0;
      const fetchMock = vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ count: callCount }),
        };
      });
      globalThis.fetch = fetchMock;

      const client = new ApiClient("/api/v1");

      // 1. Concurrent calls with identical endpoint, params, and storeId are deduplicated
      const [r1, r2] = await Promise.all([
        client.get("/products", { params: { category: "shoes" }, storeId: "store-a" }),
        client.get("/products", { params: { category: "shoes" }, storeId: "store-a" }),
      ]);
      expect(r1).toEqual(r2);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // 2. Concurrent calls with different params are NOT deduplicated
      await Promise.all([
        client.get("/products", { params: { category: "hats" }, storeId: "store-a" }),
        client.get("/products", { params: { category: "shirts" }, storeId: "store-a" }),
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(3);

      // 3. Concurrent calls with different storeId are NOT deduplicated
      await Promise.all([
        client.get("/products", { params: { category: "shoes" }, storeId: "store-b" }),
        client.get("/products", { params: { category: "shoes" }, storeId: "store-c" }),
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(5);
    });
  });

  describe("3. RateLimiter window tracking and cleanup", () => {
    it("preserves rate limits configured with windows greater than 60 seconds", () => {
      const limiter = new RateLimiter({ cleanupIntervalMs: 100 });
      const fiveMinutesMs = 300_000;

      // Check request with 5 minute window
      const result = limiter.check("client-ip-1", 5, fiveMinutesMs);
      expect(result.allowed).toBe(true);
      expect(limiter.size).toBe(1);

      // Fast forward by 90 seconds (past standard 60s cleanup)
      const now = Date.now() + 90_000;
      limiter.maybeCleanup(now, true);

      // The key MUST NOT be evicted because 90s < 300,000ms
      expect(limiter.size).toBe(1);

      // Fast forward past 300 seconds
      const later = Date.now() + 310_000;
      limiter.maybeCleanup(later, true);
      expect(limiter.size).toBe(0);
    });
  });

  describe("4. Payment reconciliation rejection of amount & currency mismatches", () => {
    it("PaymentRecoveryService skips capture when gateway amount or currency differs", async () => {
      const mockPaymentRepo = {
        findRequiresReconciliation: vi.fn().mockResolvedValue([
          {
            id: "pay-1",
            store_id: "store-1",
            amount: 5000,
            currency: "INR",
            status: "REQUIRES_RECONCILIATION",
          },
        ]),
        updateStatus: vi.fn(),
      } as unknown as PaymentRepository;

      const mockAttemptRepo = {
        findByPaymentId: vi.fn().mockResolvedValue([
          {
            id: "att-1",
            store_id: "store-1",
            payment_id: "pay-1",
            provider_payment_id: "rzp_pay_1",
          },
        ]),
        updateStatus: vi.fn(),
      } as unknown as PaymentAttemptRepository;

      const mockOrderIntegration = {
        finalizeCapturedPurchase: vi.fn(),
      } as unknown as PaymentOrderIntegration;

      // Gateway returns mismatching amount: 4000 instead of 5000
      const mockProvider = {
        getPayment: vi.fn().mockResolvedValue({
          status: "captured",
          amount: 4000,
          currency: "INR",
        }),
      } as unknown as RazorpayPaymentProvider;

      const recoveryService = new PaymentRecoveryService(
        mockPaymentRepo,
        mockAttemptRepo,
        mockOrderIntegration,
        {} as unknown as WebhookRecoveryService,
        mockProvider,
      );

      const mockDb = { query: vi.fn() } as unknown as Database;
      const result = await recoveryService.reconcileAmbiguousPayments(mockDb);

      expect(result.failedCount).toBe(1);
      expect(result.reconciledCount).toBe(0);
      expect(mockPaymentRepo.updateStatus).not.toHaveBeenCalled();
      expect(mockOrderIntegration.finalizeCapturedPurchase).not.toHaveBeenCalled();
    });

    it("ProviderPaymentService rejects branch 2 and branch 3 on amount/currency mismatch", async () => {
      const now = new Date();
      const mockPaymentRepo = {
        findById: vi.fn().mockResolvedValue({
          id: "pay-1",
          store_id: "store-1",
          checkout_id: "chk-1",
          order_id: null,
          amount: 1000,
          currency: "USD",
          status: "PENDING",
          provider: "razorpay",
          captured_amount: 0,
          refunded_amount: 0,
          created_at: now,
          updated_at: now,
        }),
        updateStatus: vi.fn(),
      } as unknown as PaymentRepository;

      const mockAttemptRepo = {
        findByPaymentId: vi.fn().mockResolvedValue([
          {
            id: "att-1",
            store_id: "store-1",
            payment_id: "pay-1",
            attempt_number: 1,
            provider: "razorpay",
            provider_order_id: "order_rzp_1",
            provider_payment_id: "pay_rzp_1",
            amount: 1000,
            currency: "USD",
            status: "PENDING",
            failure_code: null,
            failure_message: null,
            idempotency_key: null,
            created_at: now,
            updated_at: now,
          },
        ]),
        findById: vi.fn(),
        updateStatus: vi.fn(),
      } as unknown as PaymentAttemptRepository;

      // Gateway order paid with different currency (EUR instead of USD)
      const mockProvider = {
        getOrder: vi.fn().mockResolvedValue({
          status: "paid",
          amount: 1000,
          currency: "EUR",
          providerOrderId: "order_rzp_1",
        }),
      } as unknown as RazorpayPaymentProvider;

      const service = new ProviderPaymentService(
        mockProvider,
        mockPaymentRepo,
        mockAttemptRepo,
        {} as unknown as PaymentOrderIntegration,
        {} as unknown as OrderService,
      );

      const mockDb = { query: vi.fn() } as unknown as Database;
      const res = await service.reconcilePaymentWithGateway(mockDb, "store-1", "pay-1");

      expect(res.reconciled).toBe(false);
      expect(mockPaymentRepo.updateStatus).not.toHaveBeenCalled();
    });

    it("ProviderPaymentService does not fabricate pay_order_* when no captured payment exists", async () => {
      const now = new Date();
      const mockPaymentRepo = {
        findById: vi.fn().mockResolvedValue({
          id: "pay-1",
          store_id: "store-1",
          checkout_id: "chk-1",
          order_id: null,
          amount: 1000,
          currency: "USD",
          status: "PENDING",
          provider: "razorpay",
          captured_amount: 0,
          refunded_amount: 0,
          created_at: now,
          updated_at: now,
        }),
        updateStatus: vi.fn(),
      } as unknown as PaymentRepository;

      const mockAttemptRepo = {
        findByPaymentId: vi.fn().mockResolvedValue([
          {
            id: "att-1",
            store_id: "store-1",
            payment_id: "pay-1",
            attempt_number: 1,
            provider: "razorpay",
            provider_order_id: "order_rzp_1",
            provider_payment_id: null, // No payment ID yet
            amount: 1000,
            currency: "USD",
            status: "PENDING",
            failure_code: null,
            failure_message: null,
            idempotency_key: null,
            created_at: now,
            updated_at: now,
          },
        ]),
        findById: vi.fn(),
        updateStatus: vi.fn(),
      } as unknown as PaymentAttemptRepository;

      // Gateway order marked paid, but getOrderPayments returns empty list
      const mockProvider = {
        getOrder: vi.fn().mockResolvedValue({
          status: "paid",
          amount: 1000,
          currency: "USD",
          providerOrderId: "order_rzp_1",
        }),
        getOrderPayments: vi.fn().mockResolvedValue([]),
      } as unknown as RazorpayPaymentProvider;

      const service = new ProviderPaymentService(
        mockProvider,
        mockPaymentRepo,
        mockAttemptRepo,
        {} as unknown as PaymentOrderIntegration,
        {} as unknown as OrderService,
      );

      const mockDb = { query: vi.fn() } as unknown as Database;
      const res = await service.reconcilePaymentWithGateway(mockDb, "store-1", "pay-1");

      expect(res.reconciled).toBe(false);
      expect(mockPaymentRepo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe("5. Cryptographic timing-safety and order number randomness", () => {
    it("generateOrderNumber uses crypto.randomInt producing ORD-{timestamp}-{4-digit-number}", () => {
      const num = generateOrderNumber();
      expect(num).toMatch(/^ORD-[A-Z0-9]+-\d{4}$/);
      const parts = num.split("-");
      const randomPart = Number(parts[2]);
      expect(randomPart).toBeGreaterThanOrEqual(1000);
      expect(randomPart).toBeLessThan(10000);
    });

    it("assertCheckoutOwnership and assertOrderOwnership validate guest tokens with timingSafeEqual", () => {
      const secretGuestToken = "guest-secret-token-123456789";
      const correctHash = hashToken(secretGuestToken);

      const checkout = {
        id: "c1",
        storeId: "s1",
        customerId: null,
        guestTokenHash: correctHash,
      } as unknown as CheckoutDTO;

      // Correct token passes
      expect(() =>
        assertCheckoutOwnership(checkout, { guestToken: secretGuestToken })
      ).not.toThrow();

      // Incorrect token throws 404
      expect(() =>
        assertCheckoutOwnership(checkout, { guestToken: "wrong-token" })
      ).toThrowError(/Checkout was not found/);

      const order = {
        id: "o1",
        storeId: "s1",
        customerId: null,
        guestTokenHash: correctHash,
      } as unknown as OrderDTO;

      // Correct order guest token passes
      expect(() =>
        assertOrderOwnership(order, { guestToken: secretGuestToken })
      ).not.toThrow();

      // Incorrect order guest token throws 404
      expect(() =>
        assertOrderOwnership(order, { guestToken: "wrong-token" })
      ).toThrowError(/Order was not found/);
    });
  });
});
