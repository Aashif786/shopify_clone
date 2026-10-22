import { beforeEach, describe, expect, it } from "vitest";
import {
  RateLimiter,
  getClientIp,
  enforceRateLimit,
  globalRateLimiter,
  AUTH_RATE_LIMIT,
  PAYMENT_VERIFY_RATE_LIMIT,
} from "../../apps/web/src/lib/rate-limiter.js";

describe("RateLimiter Unit and Security Tests", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
    globalRateLimiter.reset();
  });

  describe("Core Sliding Window Behavior", () => {
    it("allows requests up to the defined limit", () => {
      const key = "test-ip-1";
      const limit = 5;
      const windowMs = 60_000;

      for (let i = 1; i <= limit; i++) {
        const result = limiter.check(key, limit, windowMs);
        expect(result.allowed).toBe(true);
        expect(result.count).toBe(i);
        expect(result.remaining).toBe(limit - i);
      }
    });

    it("rejects the request that exceeds the limit with retryAfterSeconds", () => {
      const key = "test-ip-2";
      const limit = 5;
      const windowMs = 60_000;

      // Exhaust limit
      for (let i = 0; i < limit; i++) {
        limiter.check(key, limit, windowMs);
      }

      // 6th attempt should be blocked
      const breachResult = limiter.check(key, limit, windowMs);
      expect(breachResult.allowed).toBe(false);
      expect(breachResult.remaining).toBe(0);
      expect(breachResult.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(breachResult.retryAfterSeconds).toBeLessThanOrEqual(60);
    });

    it("maintains strict bucket isolation across different keys", () => {
      const keyA = "client-ip-a";
      const keyB = "client-ip-b";
      const limit = 5;
      const windowMs = 60_000;

      // Exhaust keyA
      for (let i = 0; i < limit; i++) {
        limiter.check(keyA, limit, windowMs);
      }
      expect(limiter.check(keyA, limit, windowMs).allowed).toBe(false);

      // keyB must still have full allowance
      const resultB = limiter.check(keyB, limit, windowMs);
      expect(resultB.allowed).toBe(true);
      expect(resultB.count).toBe(1);
      expect(resultB.remaining).toBe(4);
    });

    it("clears buckets when reset() is invoked", () => {
      const key = "test-reset";
      for (let i = 0; i < 5; i++) {
        limiter.check(key, 5, 60_000);
      }
      expect(limiter.check(key, 5, 60_000).allowed).toBe(false);

      limiter.reset();

      const freshResult = limiter.check(key, 5, 60_000);
      expect(freshResult.allowed).toBe(true);
      expect(freshResult.count).toBe(1);
    });

    it("clears a single key with clearKey()", () => {
      limiter.check("key-1", 1, 60_000);
      limiter.check("key-2", 1, 60_000);

      expect(limiter.check("key-1", 1, 60_000).allowed).toBe(false);
      expect(limiter.check("key-2", 1, 60_000).allowed).toBe(false);

      limiter.clearKey("key-1");

      expect(limiter.check("key-1", 1, 60_000).allowed).toBe(true);
      expect(limiter.check("key-2", 1, 60_000).allowed).toBe(false);
    });
  });

  describe("Client IP Extraction", () => {
    it("extracts the first IP from comma-separated x-forwarded-for", () => {
      const req = new Request("https://example.com/api/test", {
        headers: {
          "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
        },
      });
      expect(getClientIp(req)).toBe("203.0.113.195");
    });

    it("prioritizes cf-connecting-ip for Cloudflare proxy traffic", () => {
      const req = new Request("https://example.com/api/test", {
        headers: {
          "cf-connecting-ip": "198.51.100.42",
          "x-forwarded-for": "203.0.113.195",
        },
      });
      expect(getClientIp(req)).toBe("198.51.100.42");
    });

    it("uses x-real-ip when available and cf-connecting-ip is absent", () => {
      const req = new Request("https://example.com/api/test", {
        headers: {
          "x-real-ip": "192.0.2.1",
        },
      });
      expect(getClientIp(req)).toBe("192.0.2.1");
    });

    it("falls back to 127.0.0.1 when no forwarding headers exist", () => {
      const req = new Request("https://example.com/api/test");
      expect(getClientIp(req)).toBe("127.0.0.1");
    });
  });

  describe("enforceRateLimit helper & HTTP Response formatting", () => {
    it("returns null when request is within limits", () => {
      const response = enforceRateLimit("auth:login:test-ok", 5, 60_000, "req-123", limiter);
      expect(response).toBeNull();
    });

    it("returns HTTP 429 with correct headers and JSON payload when limit exceeded", async () => {
      const key = "auth:login:test-breach";
      // Exhaust 5 allowed attempts
      for (let i = 0; i < AUTH_RATE_LIMIT.limit; i++) {
        enforceRateLimit(
          key,
          AUTH_RATE_LIMIT.limit,
          AUTH_RATE_LIMIT.windowMs,
          "req-ok",
          limiter,
        );
      }

      // 6th attempt returns 429 response
      const response = enforceRateLimit(
        key,
        AUTH_RATE_LIMIT.limit,
        AUTH_RATE_LIMIT.windowMs,
        "req-breach-1",
        limiter,
      );
      expect(response).not.toBeNull();
      expect(response?.status).toBe(429);

      // Verify Rate Limit Headers
      expect(response?.headers.get("Retry-After")).toBeTruthy();
      expect(response?.headers.get("X-RateLimit-Limit")).toBe("5");
      expect(response?.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(response?.headers.get("X-RateLimit-Reset")).toBeTruthy();
      expect(response?.headers.get("x-request-id")).toBe("req-breach-1");

      // Verify JSON payload
      const body = await response?.json();
      expect(body).toEqual({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later.",
          requestId: "req-breach-1",
        },
      });
    });

    it("applies checkout payment verification limit of 10 requests per minute", async () => {
      const checkoutId = "019485bc-2309-7000-8000-000000000001";
      const key = `checkout:payment:verify:${checkoutId}`;

      // 10 attempts allowed
      for (let i = 0; i < PAYMENT_VERIFY_RATE_LIMIT.limit; i++) {
        const res = enforceRateLimit(
          key,
          PAYMENT_VERIFY_RATE_LIMIT.limit,
          PAYMENT_VERIFY_RATE_LIMIT.windowMs,
          `req-${i}`,
          limiter,
        );
        expect(res).toBeNull();
      }

      // 11th attempt blocked
      const blockedRes = enforceRateLimit(
        key,
        PAYMENT_VERIFY_RATE_LIMIT.limit,
        PAYMENT_VERIFY_RATE_LIMIT.windowMs,
        "req-verify-11",
        limiter,
      );
      expect(blockedRes).not.toBeNull();
      expect(blockedRes?.status).toBe(429);

      const body = await blockedRes?.json();
      expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    });
  });
});
