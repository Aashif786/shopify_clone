import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  RateLimiter,
  getClientIp,
  isValidIp,
  globalRateLimiter,
} from "../../apps/web/src/lib/rate-limiter.js";
import { POST as verifyPaymentHandler } from "../../apps/web/app/api/v1/storefront/[storeSlug]/checkout/[checkoutId]/payment/verify/route.js";
import { POST as loginHandler } from "../../apps/web/app/api/v1/auth/login/route.js";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import { hashPassword } from "@shopify-clone/auth";
import { hashToken } from "@shopify-clone/auth";

declare global {
  var __shopify_clone_web_db: unknown;
}

describe("RateLimiter Security and Abuse Verification Tests", { timeout: 35_000 }, () => {
  let limiter: RateLimiter;
  let close: (() => Promise<void>) | undefined;

  beforeEach(() => {
    limiter = new RateLimiter();
    globalRateLimiter.reset();
  });

  afterEach(async () => {
    global.__shopify_clone_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function setupDb(): Promise<Database> {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    global.__shopify_clone_web_db = isolated.database;
    return isolated.database;
  }

  describe("Core Sliding Window and Process-Local Behavior", () => {
    it("allows requests up to the defined limit and blocks the threshold breach", () => {
      const key = "test-ip-1";
      const limit = 5;
      const windowMs = 60_000;

      for (let i = 1; i <= limit; i++) {
        const result = limiter.check(key, limit, windowMs);
        expect(result.allowed).toBe(true);
        expect(result.count).toBe(i);
        expect(result.remaining).toBe(limit - i);
      }

      // 6th attempt should be blocked with retry-after
      const breachResult = limiter.check(key, limit, windowMs);
      expect(breachResult.allowed).toBe(false);
      expect(breachResult.remaining).toBe(0);
      expect(breachResult.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(breachResult.retryAfterSeconds).toBeLessThanOrEqual(60);
    });

    it("verifies process-local behavior (multiple instances maintain independent state)", () => {
      const instance1 = new RateLimiter();
      const instance2 = new RateLimiter();
      const key = "test-local-scope";

      for (let i = 0; i < 5; i++) {
        instance1.check(key, 5, 60_000);
      }

      // Instance 1 is exhausted
      expect(instance1.check(key, 5, 60_000).allowed).toBe(false);

      // Instance 2 has zero shared state (proving counters are strictly process-local)
      const res2 = instance2.check(key, 5, 60_000);
      expect(res2.allowed).toBe(true);
      expect(res2.count).toBe(1);
    });

    it("purges stale keys on cleanup to prevent memory leaks", () => {
      limiter.check("stale-key-1", 5, 60_000);
      limiter.check("stale-key-2", 5, 60_000);

      expect(limiter.size).toBe(2);

      // Trigger cleanup as of current time where timestamps are stale (> 60s)
      limiter.maybeCleanup(Date.now() + 70_000, true);

      expect(limiter.size).toBe(0);
    });

    it("maintains bucket isolation across distinct keys", () => {
      for (let i = 0; i < 5; i++) {
        limiter.check("user-a", 5, 60_000);
      }
      expect(limiter.check("user-a", 5, 60_000).allowed).toBe(false);

      const userB = limiter.check("user-b", 5, 60_000);
      expect(userB.allowed).toBe(true);
      expect(userB.remaining).toBe(4);
    });
  });

  describe("Client IP Extraction and Anti-Spoofing", () => {
    it("extracts the rightmost valid proxy hop to prevent client prefix spoofing", () => {
      // Attacker prepends fake IP "10.0.0.1", proxy appends real socket address "203.0.113.195"
      const req = new Request("https://example.com/api/test", {
        headers: {
          "x-forwarded-for": "10.0.0.1, 70.41.3.18, 203.0.113.195",
        },
      });
      expect(getClientIp(req)).toBe("203.0.113.195");
    });

    it("extracts cf-connecting-ip for Cloudflare edge traffic", () => {
      const req = new Request("https://example.com/api/test", {
        headers: {
          "cf-connecting-ip": "198.51.100.42",
          "cf-ray": "8d3f1a9b2c3d4e5f-EWR",
        },
      });
      expect(getClientIp(req)).toBe("198.51.100.42");
    });

    it("validates IPv4 and IPv6 structures", () => {
      expect(isValidIp("192.168.1.1")).toBe(true);
      expect(isValidIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe(true);
      expect(isValidIp("::1")).toBe(true);
      expect(isValidIp("invalid-ip")).toBe(false);
      expect(isValidIp("999.999.999.999")).toBe(false);
      expect(isValidIp("<script>alert(1)</script>")).toBe(false);
    });

    it("falls back to 127.0.0.1 when forwarding headers contain malicious or invalid payloads", () => {
      const req = new Request("https://example.com/api/test", {
        headers: {
          "x-forwarded-for": "spoofed_header_injection_payload",
        },
      });
      expect(getClientIp(req)).toBe("127.0.0.1");
    });
  });

  describe("Dual-Factor Login Rate Limiting & Identity Rotation Defense", () => {
    it("prevents clients from rotating forwarding headers to bypass login rate limits", async () => {
      const db = await setupDb();
      const userId = generateUuidV7();
      const targetEmail = "merchant-target@example.com";
      const passwordHash = await hashPassword("ValidPassword123!");

      await db.query(
        `INSERT INTO users (id, email, password_hash, name, status)
         VALUES ($1, $2, $3, 'Target Merchant', 'ACTIVE')`,
        [userId, targetEmail, passwordHash],
      );

      // Attacker attempts 5 logins with wrong password, rotating X-Forwarded-For each time
      for (let i = 1; i <= 5; i++) {
        const req = new Request("http://localhost:3000/api/v1/auth/login", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": `198.51.100.${i}`, // Rotated IP on every request
          },
          body: JSON.stringify({
            email: targetEmail,
            password: "WrongPassword!",
          }),
        });

        const res = await loginHandler(req);
        // First 5 attempts return 401 Invalid Credentials
        expect(res.status).toBe(401);
      }

      // 6th attempt: Attacker supplies yet another new IP "198.51.100.99"
      const req6 = new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.99",
        },
        body: JSON.stringify({
          email: targetEmail,
          password: "WrongPassword!",
        }),
      });

      const res6 = await loginHandler(req6);

      // MUST be blocked with HTTP 429 Too Many Requests because the account quota was reached!
      expect(res6.status).toBe(429);
      const body6 = await res6.json();
      expect(body6.error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(res6.headers.get("Retry-After")).toBeTruthy();
    });
  });

  describe("Payment Verification Handler Abuse Controls & Rate Limiting Precedence", () => {
    async function seedStoreWithCheckouts(db: Database) {
      const orgId = generateUuidV7();
      const storeIdA = generateUuidV7();
      const storeIdB = generateUuidV7();
      const slugA = `store-a-${Date.now().toString(36)}`;
      const slugB = `store-b-${Date.now().toString(36)}`;

      await db.query(
        `INSERT INTO organizations (id, name, status) VALUES ($1, 'Org Test', 'ACTIVE')`,
        [orgId],
      );
      await db.query(
        `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
         VALUES ($1, $2, 'Store A', $3, 'ACTIVE', 'USD', 'en-US', 'America/New_York'),
                ($4, $2, 'Store B', $5, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
        [storeIdA, orgId, slugA, storeIdB, slugB],
      );

      const customerIdA = generateUuidV7();
      const customerIdB = generateUuidV7();
      await db.query(
        `INSERT INTO customers (id, store_id, email, status)
         VALUES ($1, $2, 'customera@example.com', 'ACTIVE'),
                ($3, $4, 'customerb@example.com', 'ACTIVE')`,
        [customerIdA, storeIdA, customerIdB, storeIdA],
      );

      const cartIdA = generateUuidV7();
      await db.query(
        `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
        [cartIdA, storeIdA],
      );

      const guestTokenA = "guest_token_secret_value_customer_a_123456";
      const guestTokenHashA = hashToken(guestTokenA);

      const checkoutIdA = generateUuidV7();
      await db.query(
        `INSERT INTO checkouts (id, store_id, cart_id, customer_id, guest_token_hash, total, status, payment_status, currency)
         VALUES ($1, $2, $3, $4, $5, 5000, 'OPEN', 'PENDING', 'USD')`,
        [checkoutIdA, storeIdA, cartIdA, customerIdA, guestTokenHashA],
      );

      return {
        storeIdA,
        storeIdB,
        slugA,
        slugB,
        customerIdA,
        customerIdB,
        checkoutIdA,
        guestTokenA,
      };
    }

    it("rejects invalid/non-UUID checkout identifiers with 400", async () => {
      const req = new Request("http://localhost:3000/api/v1/storefront/store-a/checkout/invalid-uuid/payment/verify", {
        method: "POST",
      });
      const res = await verifyPaymentHandler(req, {
        params: Promise.resolve({ storeSlug: "store-a", checkoutId: "invalid-uuid" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects non-existent checkout with 404", async () => {
      const db = await setupDb();
      const { slugA } = await seedStoreWithCheckouts(db);
      const fakeCheckoutId = generateUuidV7();

      const req = new Request(`http://localhost:3000/api/v1/storefront/${slugA}/checkout/${fakeCheckoutId}/payment/verify`, {
        method: "POST",
      });
      const res = await verifyPaymentHandler(req, {
        params: Promise.resolve({ storeSlug: slugA, checkoutId: fakeCheckoutId }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("CHECKOUT_NOT_FOUND");
    });

    it("enforces store isolation (checkout in store A requested under store B returns 404)", async () => {
      const db = await setupDb();
      const { slugB, checkoutIdA } = await seedStoreWithCheckouts(db);

      const req = new Request(`http://localhost:3000/api/v1/storefront/${slugB}/checkout/${checkoutIdA}/payment/verify`, {
        method: "POST",
      });
      const res = await verifyPaymentHandler(req, {
        params: Promise.resolve({ storeSlug: slugB, checkoutId: checkoutIdA }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("CHECKOUT_NOT_FOUND");
    });

    it("ensures unauthorized verification attempts do NOT consume the checkout owner's rate-limit budget", async () => {
      const db = await setupDb();
      const { slugA, checkoutIdA, guestTokenA } = await seedStoreWithCheckouts(db);

      // Attacker attempts 15 verification requests for Customer A's checkout with an invalid guest token
      for (let i = 0; i < 15; i++) {
        const attackerReq = new Request(
          `http://localhost:3000/api/v1/storefront/${slugA}/checkout/${checkoutIdA}/payment/verify`,
          {
            method: "POST",
            headers: {
              "x-guest-token": "wrong_attacker_guest_token",
              "x-forwarded-for": `192.0.2.${i + 1}`,
            },
          },
        );

        const attackerRes = await verifyPaymentHandler(attackerReq, {
          params: Promise.resolve({ storeSlug: slugA, checkoutId: checkoutIdA }),
        });

        // Must be rejected with 404 Not Found to prevent checkout ID enumeration
        expect(attackerRes.status).toBe(404);
      }

      // NOW: The legitimate owner (Customer A) sends a verification request with the correct guest token
      const ownerReq = new Request(
        `http://localhost:3000/api/v1/storefront/${slugA}/checkout/${checkoutIdA}/payment/verify`,
        {
          method: "POST",
          headers: {
            "x-guest-token": guestTokenA,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            paymentId: generateUuidV7(),
            attemptId: generateUuidV7(),
            razorpayPaymentId: "pay_test_123",
            razorpayOrderId: "order_test_123",
            razorpaySignature: "dummy_sig",
          }),
        },
      );

      const ownerRes = await verifyPaymentHandler(ownerReq, {
        params: Promise.resolve({ storeSlug: slugA, checkoutId: checkoutIdA }),
      });

      // The owner is NOT blocked with 429! The attacker's 15 requests did NOT consume Customer A's quota!
      expect(ownerRes.status).not.toBe(429);
      // It passes authorization (status will proceed to body/payment verification)
      expect(ownerRes.status).not.toBe(403);
    });

    it("preserves legitimate retries up to 10 requests/min and blocks on the 11th", async () => {
      const db = await setupDb();
      const { slugA, checkoutIdA, guestTokenA } = await seedStoreWithCheckouts(db);

      // Customer A retries 10 times with valid authorization
      for (let i = 0; i < 10; i++) {
        const ownerReq = new Request(
          `http://localhost:3000/api/v1/storefront/${slugA}/checkout/${checkoutIdA}/payment/verify`,
          {
            method: "POST",
            headers: {
              "x-guest-token": guestTokenA,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              paymentId: generateUuidV7(),
              attemptId: generateUuidV7(),
              razorpayPaymentId: "pay_test_123",
              razorpayOrderId: "order_test_123",
              razorpaySignature: "dummy_sig",
            }),
          },
        );

        const res = await verifyPaymentHandler(ownerReq, {
          params: Promise.resolve({ storeSlug: slugA, checkoutId: checkoutIdA }),
        });

        // All 10 legitimate retries are permitted through the rate limiter (not 429)
        expect(res.status).not.toBe(429);
      }

      // 11th attempt by the owner within the minute window is rate limited
      const req11 = new Request(
        `http://localhost:3000/api/v1/storefront/${slugA}/checkout/${checkoutIdA}/payment/verify`,
        {
          method: "POST",
          headers: {
            "x-guest-token": guestTokenA,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            paymentId: generateUuidV7(),
            attemptId: generateUuidV7(),
            razorpayPaymentId: "pay_test_123",
            razorpayOrderId: "order_test_123",
            razorpaySignature: "dummy_sig",
          }),
        },
      );

      const res11 = await verifyPaymentHandler(req11, {
        params: Promise.resolve({ storeSlug: slugA, checkoutId: checkoutIdA }),
      });

      expect(res11.status).toBe(429);
      const body11 = await res11.json();
      expect(body11.error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(res11.headers.get("Retry-After")).toBeTruthy();
    });
  });
});
