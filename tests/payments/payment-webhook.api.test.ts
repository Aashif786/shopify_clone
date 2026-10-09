import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { createHmac } from "node:crypto";
import {
  handleRazorpayWebhook,
  POST as razorpayWebhookRoute,
} from "../../apps/web/app/api/v1/webhooks/payments/razorpay/route.js";
import { PaymentService } from "../../modules/payments/src/application/payment-service.js";
import { PaymentWebhookService } from "../../modules/payments/src/application/payment-webhook-service.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

declare global {
  var __shopify_clone_web_db: unknown;
}

describe("Razorpay Webhook API Route (/api/v1/webhooks/payments/razorpay)", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const paymentService = new PaymentService();
  const testSecret = "whsec_api_test_secret_99887766";

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__shopify_clone_web_db = db;
    process.env.RAZORPAY_WEBHOOK_SECRET = testSecret;
  });

  afterEach(async () => {
    global.__shopify_clone_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function seedTestStore(
    slug = "api-wh-store",
  ): Promise<{ orgId: string; storeId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${slug}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, `Store ${slug}`, slug],
    );
    return { orgId, storeId };
  }

  async function seedTestCart(storeId: string): Promise<string> {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );
    return cartId;
  }

  async function seedTestCheckout(storeId: string, cartId: string, total = 5000): Promise<string> {
    const checkoutId = generateUuidV7();
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, $4, 'OPEN', 'PENDING', 'USD')`,
      [checkoutId, storeId, cartId, total],
    );
    return checkoutId;
  }

  function signBody(body: string, secret = testSecret): string {
    return createHmac("sha256", secret).update(body).digest("hex");
  }

  describe("1. Cryptographic Authentication & Public Boundary", () => {
    it("returns 400 Bad Request if x-razorpay-signature header is missing", async () => {
      const body = JSON.stringify({ entity: "event", event: "payment.captured" });
      const req = new Request("http://localhost:3000/api/v1/webhooks/payments/razorpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const res = await razorpayWebhookRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Missing webhook signature");
    });

    it("returns 400 Bad Request if signature is invalid", async () => {
      const body = JSON.stringify({ entity: "event", event: "payment.captured" });
      const req = new Request("http://localhost:3000/api/v1/webhooks/payments/razorpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": "tampered_signature_hex",
        },
        body,
      });

      const res = await razorpayWebhookRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Invalid Razorpay webhook signature");
    });

    it("does not require user or merchant tenant authentication session", async () => {
      const { storeId } = await seedTestStore("no-auth-required");
      const cartId = await seedTestCart(storeId);
      const checkoutId = await seedTestCheckout(storeId, cartId, 4000);

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const orderId = "order_NOAUTH_1";
      await db.query(
        `UPDATE payment_attempts SET provider_order_id = $1, status = 'PENDING' WHERE id = $2`,
        [orderId, localPayment.attempt.id],
      );

      const body = JSON.stringify({
        id: "evt_noauth_123",
        entity: "event",
        event: "payment.captured",
        contains: ["payment"],
        payload: {
          payment: {
            entity: {
              id: "pay_NOAUTH_1",
              amount: 4000,
              currency: "USD",
              status: "captured",
              order_id: orderId,
            },
          },
        },
        created_at: 1700000000,
      });

      // No Cookie or Authorization headers
      const req = new Request("http://localhost:3000/api/v1/webhooks/payments/razorpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": signBody(body),
          "x-razorpay-event-id": "evt_noauth_123",
        },
        body,
      });

      const res = await razorpayWebhookRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.received).toBe(true);
    });
  });

  describe("2. Payload Validation & Error Handling", () => {
    it("returns 400 Bad Request on empty body", async () => {
      const req = new Request("http://localhost:3000/api/v1/webhooks/payments/razorpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": "some_sig",
        },
        body: "",
      });

      const res = await razorpayWebhookRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Empty request body");
    });

    it("returns 400 Bad Request on malformed JSON payload", async () => {
      const badJson = "{ invalid json string ";
      const req = new Request("http://localhost:3000/api/v1/webhooks/payments/razorpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": signBody(badJson),
        },
        body: badJson,
      });

      const res = await razorpayWebhookRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Malformed JSON");
    });
  });

  describe("3. Deduplication & Idempotent Responses", () => {
    it("returns 200 { received: true, duplicate: true } on duplicate delivery", async () => {
      const { storeId } = await seedTestStore("api-dedup");
      const cartId = await seedTestCart(storeId);
      const checkoutId = await seedTestCheckout(storeId, cartId, 5500);

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const orderId = "order_APIDEDUP_1";
      await db.query(
        `UPDATE payment_attempts SET provider_order_id = $1, status = 'PENDING' WHERE id = $2`,
        [orderId, localPayment.attempt.id],
      );

      const body = JSON.stringify({
        id: "evt_route_dup_1",
        entity: "event",
        event: "payment.captured",
        contains: ["payment"],
        payload: {
          payment: {
            entity: {
              id: "pay_APIDEDUP_1",
              amount: 5500,
              currency: "USD",
              status: "captured",
              order_id: orderId,
            },
          },
        },
        created_at: 1700000000,
      });

      const sig = signBody(body);

      // First delivery
      const req1 = new Request("http://localhost:3000/api/v1/webhooks/payments/razorpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": sig,
          "x-razorpay-event-id": "evt_route_dup_1",
        },
        body,
      });

      const res1 = await razorpayWebhookRoute(req1);
      expect(res1.status).toBe(200);
      const json1 = await res1.json();
      expect(json1.received).toBe(true);
      expect(json1.duplicate).toBeUndefined();

      // Duplicate delivery
      const req2 = new Request("http://localhost:3000/api/v1/webhooks/payments/razorpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": sig,
          "x-razorpay-event-id": "evt_route_dup_1",
        },
        body,
      });

      const res2 = await razorpayWebhookRoute(req2);
      expect(res2.status).toBe(200);
      const json2 = await res2.json();
      expect(json2.received).toBe(true);
      expect(json2.duplicate).toBe(true);
    });
  });

  describe("4. Transient Processing Failures & HTTP 500 Retry Trigger", () => {
    it("returns HTTP 500 when processing fails unexpectedly to trigger provider retry", async () => {
      const body = JSON.stringify({
        id: "evt_crash_1",
        entity: "event",
        event: "payment.captured",
        contains: ["payment"],
        payload: {
          payment: {
            entity: {
              id: "pay_crash_1",
              amount: 1000,
              currency: "USD",
              status: "captured",
            },
          },
        },
        created_at: 1700000000,
      });

      // Mock service that throws a transient failure
      const mockService = {
        processWebhook: async () => {
          throw new Error("Simulated database connection drop");
        },
      } as unknown as PaymentWebhookService;

      const req = new Request("http://localhost:3000/api/v1/webhooks/payments/razorpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": signBody(body),
        },
        body,
      });

      const res = await handleRazorpayWebhook(req, {
        webhookService: mockService,
        webhookSecret: testSecret,
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Webhook processing failure");
      // Verify secrets and stack traces are not leaked in response
      expect(json.stack).toBeUndefined();
    });
  });
});
