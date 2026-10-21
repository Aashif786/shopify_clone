import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import {
  PaymentCheckoutCoordinator,
  ProviderPaymentService,
  RazorpayPaymentProvider,
  RazorpayClient,
  PaymentWebhookService,
  WebhookSecretConfigurationError,
} from "@shopify-clone/payments";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import { getRazorpayProvider } from "../../apps/web/src/lib/payment-provider-helper.js";
import { ApiHttpError } from "../../apps/web/src/lib/api/errors.js";

describe("Payment Fail-Closed Security and Webhook Integrity Tests", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const paymentCoordinator = new PaymentCheckoutCoordinator();

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function setupDb(): Promise<Database> {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    return isolated.database;
  }

  async function seedStoreAndCheckout(
    db: Database,
    slug = "payment-sec-store",
  ): Promise<{
    storeId: string;
    checkoutId: string;
  }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const cartId = generateUuidV7();

    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, 'Payment Org', 'ACTIVE')`, [orgId]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, 'Payment Store', $3, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, slug],
    );

    await db.query(
      `INSERT INTO carts (id, store_id, currency, subtotal, discount_total, grand_total, status)
       VALUES ($1, $2, 'USD', 5000, 0, 5000, 'CONVERTED')`,
      [cartId, storeId],
    );

    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, currency, subtotal, discount_total, shipping_total, tax_total, total, status, payment_status, email)
       VALUES ($1, $2, $3, 'USD', 5000, 0, 0, 0, 5000, 'OPEN', 'PENDING', 'customer@example.com')`,
      [checkoutId, storeId, cartId],
    );

    return { storeId, checkoutId };
  }

  it("fails closed when Razorpay credentials are missing and never uses fake test placeholders", () => {
    const originalKeyId = process.env.RAZORPAY_KEY_ID;
    const originalNextKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const originalSecret = process.env.RAZORPAY_KEY_SECRET;

    try {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;

      expect(() => getRazorpayProvider()).toThrow(ApiHttpError);
      try {
        getRazorpayProvider();
      } catch (err: unknown) {
        if (err instanceof ApiHttpError) {
          expect(err.status).toBe(500);
          expect(err.code).toBe("PAYMENT_GATEWAY_NOT_CONFIGURED");
          expect(err.message).toContain("not properly configured");
        } else {
          throw err;
        }
      }
    } finally {
      if (originalKeyId) process.env.RAZORPAY_KEY_ID = originalKeyId;
      if (originalNextKeyId) process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = originalNextKeyId;
      if (originalSecret) process.env.RAZORPAY_KEY_SECRET = originalSecret;
    }
  });

  it("rejects webhook processing with 500 WebhookSecretConfigurationError when RAZORPAY_WEBHOOK_SECRET is absent", async () => {
    const db = await setupDb();
    const webhookService = new PaymentWebhookService("");

    // Call without secret
    await expect(
      webhookService.processWebhook(db, {
        rawBody: JSON.stringify({ event: "payment.captured" }),
        signature: "some-signature",
        webhookSecret: "",
      }),
    ).rejects.toThrow(WebhookSecretConfigurationError);

    try {
      await webhookService.processWebhook(db, {
        rawBody: JSON.stringify({ event: "payment.captured" }),
        signature: "some-signature",
        webhookSecret: "",
      });
    } catch (err: unknown) {
      if (err instanceof WebhookSecretConfigurationError) {
        expect(err.status).toBe(500);
        expect(err.code).toBe("PAYMENT_WEBHOOK_CONFIG_ERROR");
      } else {
        throw err;
      }
    }
  });

  it("rejects invalid webhook signatures", async () => {
    const db = await setupDb();
    const webhookService = new PaymentWebhookService();

    await expect(
      webhookService.processWebhook(db, {
        rawBody: JSON.stringify({ event: "payment.captured" }),
        signature: "invalid_hex_signature_12345",
        secret: "test_webhook_secret_xyz",
      }),
    ).rejects.toThrow();
  });

  it("rejects payment verification when payment attempt is associated with a different checkout ID", async () => {
    const db = await setupDb();
    const { storeId, checkoutId } = await seedStoreAndCheckout(db);
    const otherCheckoutId = generateUuidV7();

    // Initialize payment for checkoutId
    const initResult = await paymentCoordinator.initializePaymentForCheckout(db, {
      storeId,
      checkoutId,
      provider: "RAZORPAY",
    });

    const keyId = "rzp_test_valid_key";
    const keySecret = "rzp_test_valid_secret";
    const client = new RazorpayClient({ keyId, keySecret });
    const provider = new RazorpayPaymentProvider({ keyId, keySecret, client });
    const providerService = new ProviderPaymentService(provider);

    // Attempt to verify against otherCheckoutId -> must be rejected
    await expect(
      providerService.verifyAndProcessCallback(db, {
        storeId,
        checkoutId: otherCheckoutId,
        paymentId: initResult.payment.id,
        attemptId: initResult.attempt.id,
        razorpayPaymentId: "pay_123",
        razorpayOrderId: "order_123",
        razorpaySignature: "dummy_sig",
      }),
    ).rejects.toThrow();
  });

  it("fails closed in production mode when test credentials (rzp_test_) are configured", () => {
    const oldNodeEnv = process.env.NODE_ENV;
    const oldKeyId = process.env.RAZORPAY_KEY_ID;
    const oldSecret = process.env.RAZORPAY_KEY_SECRET;

    try {
      process.env.NODE_ENV = "production";
      process.env.RAZORPAY_KEY_ID = "rzp_test_productionFakeKey123";
      process.env.RAZORPAY_KEY_SECRET = "production_secret_key_999";

      expect(() => getRazorpayProvider()).toThrow(ApiHttpError);
      try {
        getRazorpayProvider();
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiHttpError);
        expect((err as ApiHttpError).status).toBe(500);
        expect((err as ApiHttpError).code).toBe("PAYMENT_GATEWAY_NOT_CONFIGURED");
        expect((err as ApiHttpError).message).toContain("test credentials cannot be used in production");
      }
    } finally {
      process.env.NODE_ENV = oldNodeEnv;
      if (oldKeyId) process.env.RAZORPAY_KEY_ID = oldKeyId;
      else delete process.env.RAZORPAY_KEY_ID;
      if (oldSecret) process.env.RAZORPAY_KEY_SECRET = oldSecret;
      else delete process.env.RAZORPAY_KEY_SECRET;
    }
  });

  it("rejects placeholder webhook secrets with 500 WebhookSecretConfigurationError", async () => {
    const db = await setupDb();
    const webhookService = new PaymentWebhookService("placeholder_webhook_secret");

    await expect(
      webhookService.processWebhook(db, {
        rawBody: JSON.stringify({ event: "payment.captured" }),
        signature: "some_sig",
      }),
    ).rejects.toThrow(WebhookSecretConfigurationError);
  });
});
