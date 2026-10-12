import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { createHmac } from "node:crypto";
import { PaymentService } from "../../modules/payments/src/application/payment-service.js";
import { ProviderPaymentService } from "../../modules/payments/src/application/provider-payment-service.js";
import {
  CrossStorePaymentAccessError,
  PaymentAmountMismatchError,
  PaymentCurrencyMismatchError,
  PaymentValidationError,
} from "../../modules/payments/src/domain/payment-errors.js";
import {
  type HttpTransport,
  RazorpayClient,
} from "../../modules/payments/src/infrastructure/razorpay-client.js";
import { RazorpayPaymentProvider } from "../../modules/payments/src/providers/razorpay-provider.js";
import { RazorpayTimeoutError } from "../../modules/payments/src/providers/razorpay-types.js";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("ProviderPaymentService Application Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const paymentService = new PaymentService();

  const defaultKeyId = "rzp_test_srvKeyId";
  const defaultKeySecret = "rzp_test_secret_srv123456";

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

  async function seedTestStore(
    db: Database,
    slug = "rzp-srv-store",
    currency = "USD",
  ): Promise<{ orgId: string; storeId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${slug}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5, 'en-US', 'America/New_York')`,
      [storeId, orgId, `Store ${slug}`, slug, currency],
    );
    return { orgId, storeId };
  }

  async function seedTestCart(db: Database, storeId: string): Promise<string> {
    const cartId = generateUuidV7();
    await db.query(
      `INSERT INTO carts (id, store_id, status) VALUES ($1, $2, 'ACTIVE')`,
      [cartId, storeId],
    );
    return cartId;
  }

  async function seedTestCheckout(
    db: Database,
    storeId: string,
    cartId: string,
    total = 5000,
    status = "OPEN",
    currency = "USD",
  ): Promise<string> {
    const checkoutId = generateUuidV7();
    await db.query(
      `INSERT INTO checkouts (id, store_id, cart_id, total, status, payment_status, currency)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)`,
      [checkoutId, storeId, cartId, total, status, currency],
    );
    return checkoutId;
  }

  function computeValidSignature(orderId: string, paymentId: string, secret = defaultKeySecret): string {
    return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  }

  function createMockProvider(options?: {
    createOrderResponse?: (body: Record<string, unknown>) => Response | Promise<Response>;
    getPaymentResponse?: (paymentId: string) => Response | Promise<Response>;
    timeoutOnOrder?: boolean;
  }): { provider: RazorpayPaymentProvider; calls: { orders: number; payments: number } } {
    const calls = { orders: 0, payments: 0 };

    const transport: HttpTransport = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/orders") && init?.method === "POST") {
        calls.orders++;
        if (options?.timeoutOnOrder) {
          const abortErr = new Error("This operation was aborted");
          abortErr.name = "AbortError";
          throw abortErr;
        }
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        if (options?.createOrderResponse) {
          return options.createOrderResponse(body);
        }
        return new Response(
          JSON.stringify({
            id: `order_MOCK_${body.receipt?.slice(0, 8)}`,
            entity: "order",
            amount: body.amount,
            amount_paid: 0,
            amount_due: body.amount,
            currency: body.currency,
            receipt: body.receipt,
            status: "created",
            attempts: 0,
            created_at: 1700000000,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("/payments/") && init?.method === "GET") {
        calls.payments++;
        const pId = url.split("/payments/")[1] ?? "pay_unknown";
        if (options?.getPaymentResponse) {
          return options.getPaymentResponse(pId);
        }
        return new Response(
          JSON.stringify({
            id: pId,
            entity: "payment",
            amount: 5000,
            currency: "USD",
            status: "captured",
            order_id: "order_MOCK_TEST",
            method: "card",
            captured: true,
            created_at: 1700000000,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404 });
    };

    const client = new RazorpayClient({
      keyId: defaultKeyId,
      keySecret: defaultKeySecret,
      transport,
    });
    const provider = new RazorpayPaymentProvider({
      keyId: defaultKeyId,
      keySecret: defaultKeySecret,
      client,
    });
    return { provider, calls };
  }

  describe("1. Provider Order Creation", () => {
    it("creates Razorpay order from persisted attempt snapshot and saves providerOrderId", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "rzp-ord-create");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 9500, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const { provider, calls } = createMockProvider();
      const service = new ProviderPaymentService(provider);

      const result = await service.createProviderOrder(
        db,
        storeId,
        localPayment.payment.id,
        localPayment.attempt.id,
      );

      expect(calls.orders).toBe(1);
      expect(result.providerOrderId).toMatch(/^order_MOCK_/);
      expect(result.amount).toBe(9500);
      expect(result.currency).toBe("USD");
      expect(result.razorpayKeyId).toBe(defaultKeyId);

      // Verify database persistence
      const pmtQuery = await db.query<{ status: string }>(
        `SELECT status FROM payments WHERE id = $1`,
        [localPayment.payment.id],
      );
      expect(pmtQuery.rows[0]?.status).toBe("PENDING");

      const attQuery = await db.query<{ status: string; provider_order_id: string }>(
        `SELECT status, provider_order_id FROM payment_attempts WHERE id = $1`,
        [localPayment.attempt.id],
      );
      expect(attQuery.rows[0]?.status).toBe("PENDING");
      expect(attQuery.rows[0]?.provider_order_id).toBe(result.providerOrderId);
    });

    it("enforces tenant boundary on order creation", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "rzp-store-a");
      const { storeId: storeB } = await seedTestStore(db, "rzp-store-b");
      const cartId = await seedTestCart(db, storeA);
      const checkoutId = await seedTestCheckout(db, storeA, cartId, 5000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId: storeA,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const { provider } = createMockProvider();
      const service = new ProviderPaymentService(provider);

      // Accessing store A's payment with store B's credentials must throw CrossStorePaymentAccessError
      await expect(
        service.createProviderOrder(
          db,
          storeB,
          localPayment.payment.id,
          localPayment.attempt.id,
        ),
      ).rejects.toThrow(CrossStorePaymentAccessError);
    });

    it("idempotently returns existing providerOrderId without re-calling Razorpay API", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "rzp-ord-idemp");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 4000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const { provider, calls } = createMockProvider();
      const service = new ProviderPaymentService(provider);

      const firstResult = await service.createProviderOrder(
        db,
        storeId,
        localPayment.payment.id,
        localPayment.attempt.id,
      );
      expect(calls.orders).toBe(1);

      const secondResult = await service.createProviderOrder(
        db,
        storeId,
        localPayment.payment.id,
        localPayment.attempt.id,
      );
      // No duplicate API call
      expect(calls.orders).toBe(1);
      expect(secondResult.providerOrderId).toBe(firstResult.providerOrderId);
    });

    it("handles order-creation timeout by setting REQUIRES_RECONCILIATION without false failure", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "rzp-ord-timeout");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 3000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const { provider } = createMockProvider({ timeoutOnOrder: true });
      const service = new ProviderPaymentService(provider);

      await expect(
        service.createProviderOrder(
          db,
          storeId,
          localPayment.payment.id,
          localPayment.attempt.id,
        ),
      ).rejects.toThrow(RazorpayTimeoutError);

      // Verify payment was NOT marked FAILED
      const pmtQuery = await db.query<{ status: string }>(
        `SELECT status FROM payments WHERE id = $1`,
        [localPayment.payment.id],
      );
      expect(pmtQuery.rows[0]?.status).toBe("CREATED");

      // Verify attempt is marked REQUIRES_RECONCILIATION
      const attQuery = await db.query<{ status: string }>(
        `SELECT status FROM payment_attempts WHERE id = $1`,
        [localPayment.attempt.id],
      );
      expect(attQuery.rows[0]?.status).toBe("REQUIRES_RECONCILIATION");
    });
  });

  describe("2. Frontend Payment Callback Signature Verification", () => {
    it("rejects callback with invalid HMAC signature when order IDs match", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "rzp-cb-invsig");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const { provider } = createMockProvider();
      const service = new ProviderPaymentService(provider);

      const created = await service.createProviderOrder(
        db,
        storeId,
        localPayment.payment.id,
        localPayment.attempt.id,
      );

      await expect(
        service.verifyAndProcessCallback(db, {
          storeId,
          paymentId: localPayment.payment.id,
          attemptId: localPayment.attempt.id,
          razorpayOrderId: created.providerOrderId,
          razorpayPaymentId: "pay_test123",
          razorpaySignature: "invalid_tampered_signature_hex",
        }),
      ).rejects.toThrow(PaymentValidationError);
    });

    it("rejects callback when razorpayOrderId does not match attempt providerOrderId", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "rzp-cb-ordmismatch");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const { provider } = createMockProvider();
      const service = new ProviderPaymentService(provider);

      await service.createProviderOrder(
        db,
        storeId,
        localPayment.payment.id,
        localPayment.attempt.id,
      );

      const differentOrderId = "order_DIFFERENT_999";
      const validSig = computeValidSignature(differentOrderId, "pay_123");

      await expect(
        service.verifyAndProcessCallback(db, {
          storeId,
          paymentId: localPayment.payment.id,
          attemptId: localPayment.attempt.id,
          razorpayOrderId: differentOrderId,
          razorpayPaymentId: "pay_123",
          razorpaySignature: validSig,
        }),
      ).rejects.toThrow(/does not match attempt provider order ID/);
    });

    it("rejects callback when internal checkoutId is substituted for razorpayOrderId", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "rzp-cb-chksub");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const { provider } = createMockProvider();
      const service = new ProviderPaymentService(provider);

      await service.createProviderOrder(
        db,
        storeId,
        localPayment.payment.id,
        localPayment.attempt.id,
      );

      const sigWithCheckoutId = computeValidSignature(checkoutId, "pay_123");

      await expect(
        service.verifyAndProcessCallback(db, {
          storeId,
          paymentId: localPayment.payment.id,
          attemptId: localPayment.attempt.id,
          razorpayOrderId: checkoutId,
          razorpayPaymentId: "pay_123",
          razorpaySignature: sigWithCheckoutId,
        }),
      ).rejects.toThrow(/does not match attempt provider order ID/);
    });

    it("rejects callback when attempt has no persisted providerOrderId", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "rzp-cb-noord");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const { provider } = createMockProvider();
      const service = new ProviderPaymentService(provider);

      // Attempt exists but createProviderOrder was never called
      await expect(
        service.verifyAndProcessCallback(db, {
          storeId,
          paymentId: localPayment.payment.id,
          attemptId: localPayment.attempt.id,
          razorpayOrderId: "order_MOCK_XYZ",
          razorpayPaymentId: "pay_123",
          razorpaySignature: "sig_abc",
        }),
      ).rejects.toThrow(/has no associated provider order ID/);
    });

    it("rejects callback with missing or empty callback fields", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "rzp-cb-missing");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      const { provider } = createMockProvider();
      const service = new ProviderPaymentService(provider);

      const created = await service.createProviderOrder(
        db,
        storeId,
        localPayment.payment.id,
        localPayment.attempt.id,
      );

      // Missing signature
      await expect(
        service.verifyAndProcessCallback(db, {
          storeId,
          paymentId: localPayment.payment.id,
          attemptId: localPayment.attempt.id,
          razorpayOrderId: created.providerOrderId,
          razorpayPaymentId: "pay_123",
          razorpaySignature: "",
        }),
      ).rejects.toThrow("razorpaySignature is required");

      // Missing payment ID
      await expect(
        service.verifyAndProcessCallback(db, {
          storeId,
          paymentId: localPayment.payment.id,
          attemptId: localPayment.attempt.id,
          razorpayOrderId: created.providerOrderId,
          razorpayPaymentId: "   ",
          razorpaySignature: "sig_xyz",
        }),
      ).rejects.toThrow("razorpayPaymentId is required");

      // Missing order ID
      await expect(
        service.verifyAndProcessCallback(db, {
          storeId,
          paymentId: localPayment.payment.id,
          attemptId: localPayment.attempt.id,
          razorpayOrderId: "",
          razorpayPaymentId: "pay_123",
          razorpaySignature: "sig_xyz",
        }),
      ).rejects.toThrow("razorpayOrderId is required");
    });
  });

  describe("3. Authoritative Gateway Lookup & State Mapping", () => {
    it("transitions payment and attempt to CAPTURED when gateway reports captured", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "rzp-cb-captured");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      let assignedOrderId = "";
      const { provider } = createMockProvider({
        createOrderResponse: (body) => {
          assignedOrderId = `order_RZP_${body.receipt}`;
          return new Response(
            JSON.stringify({
              id: assignedOrderId,
              entity: "order",
              amount: 5000,
              currency: "USD",
              status: "created",
              created_at: 1700000000,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
        getPaymentResponse: (pId) => {
          return new Response(
            JSON.stringify({
              id: pId,
              entity: "payment",
              amount: 5000,
              currency: "USD",
              status: "captured",
              order_id: assignedOrderId,
              method: "card",
              captured: true,
              created_at: 1700000000,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
      });

      const service = new ProviderPaymentService(provider);
      await service.createProviderOrder(
        db,
        storeId,
        localPayment.payment.id,
        localPayment.attempt.id,
      );

      const pmtId = "pay_SUCCESS_123";
      const validSig = computeValidSignature(assignedOrderId, pmtId);

      const result = await service.verifyAndProcessCallback(db, {
        storeId,
        paymentId: localPayment.payment.id,
        attemptId: localPayment.attempt.id,
        razorpayOrderId: assignedOrderId,
        razorpayPaymentId: pmtId,
        razorpaySignature: validSig,
      });

      expect(result.payment.status).toBe("CAPTURED");
      expect(result.payment.capturedAmount).toBe(5000);
      expect(result.attempt.status).toBe("CAPTURED");
      expect(result.attempt.providerPaymentId).toBe(pmtId);

      const dbAttempt = await db.query<{ provider_signature: string }>(
        `SELECT provider_signature FROM payment_attempts WHERE id = $1`,
        [localPayment.attempt.id],
      );
      expect(dbAttempt.rows[0]?.provider_signature).toBe(validSig);

      // Verify that checkout was NOT completed in payments domain
      const chkQuery = await db.query<{ status: string; payment_status: string }>(
        `SELECT status, payment_status FROM checkouts WHERE id = $1`,
        [checkoutId],
      );
      expect(chkQuery.rows[0]?.status).not.toBe("COMPLETED");
    });

    it("transitions payment and attempt to AUTHORIZED when gateway reports authorized", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "rzp-cb-auth");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      let assignedOrderId = "";
      const { provider } = createMockProvider({
        createOrderResponse: (body) => {
          assignedOrderId = `order_AUTH_${body.receipt}`;
          return new Response(
            JSON.stringify({
              id: assignedOrderId,
              entity: "order",
              amount: 5000,
              currency: "USD",
              status: "created",
              created_at: 1700000000,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
        getPaymentResponse: (pId) => {
          return new Response(
            JSON.stringify({
              id: pId,
              entity: "payment",
              amount: 5000,
              currency: "USD",
              status: "authorized",
              order_id: assignedOrderId,
              method: "netbanking",
              captured: false,
              created_at: 1700000000,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
      });

      const service = new ProviderPaymentService(provider);
      await service.createProviderOrder(
        db,
        storeId,
        localPayment.payment.id,
        localPayment.attempt.id,
      );

      const pmtId = "pay_AUTH_456";
      const validSig = computeValidSignature(assignedOrderId, pmtId);

      const result = await service.verifyAndProcessCallback(db, {
        storeId,
        paymentId: localPayment.payment.id,
        attemptId: localPayment.attempt.id,
        razorpayOrderId: assignedOrderId,
        razorpayPaymentId: pmtId,
        razorpaySignature: validSig,
      });

      expect(result.payment.status).toBe("AUTHORIZED");
      expect(result.attempt.status).toBe("AUTHORIZED");
      expect(result.attempt.providerPaymentId).toBe(pmtId);
    });

    it("transitions payment and attempt to FAILED when gateway reports failure", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "rzp-cb-failed");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      let assignedOrderId = "";
      const { provider } = createMockProvider({
        createOrderResponse: (body) => {
          assignedOrderId = `order_FAIL_${body.receipt}`;
          return new Response(
            JSON.stringify({
              id: assignedOrderId,
              entity: "order",
              amount: 5000,
              currency: "USD",
              status: "created",
              created_at: 1700000000,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
        getPaymentResponse: (pId) => {
          return new Response(
            JSON.stringify({
              id: pId,
              entity: "payment",
              amount: 5000,
              currency: "USD",
              status: "failed",
              order_id: assignedOrderId,
              method: "card",
              captured: false,
              error_code: "BAD_REQUEST_ERROR",
              error_description: "Payment failed due to card decline",
              created_at: 1700000000,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
      });

      const service = new ProviderPaymentService(provider);
      await service.createProviderOrder(
        db,
        storeId,
        localPayment.payment.id,
        localPayment.attempt.id,
      );

      const pmtId = "pay_FAIL_789";
      const validSig = computeValidSignature(assignedOrderId, pmtId);

      const result = await service.verifyAndProcessCallback(db, {
        storeId,
        paymentId: localPayment.payment.id,
        attemptId: localPayment.attempt.id,
        razorpayOrderId: assignedOrderId,
        razorpayPaymentId: pmtId,
        razorpaySignature: validSig,
      });

      expect(result.payment.status).toBe("FAILED");
      expect(result.attempt.status).toBe("FAILED");
      expect(result.attempt.failureCode).toBe("BAD_REQUEST_ERROR");
      expect(result.attempt.failureMessage).toBe("Payment failed due to card decline");
    });
  });

  describe("4. Amount and Currency Mismatch Invariants", () => {
    it("transitions payment to REQUIRES_RECONCILIATION if gateway amount mismatches", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "rzp-cb-amtmismatch");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      let assignedOrderId = "";
      const { provider } = createMockProvider({
        createOrderResponse: (body) => {
          assignedOrderId = `order_MM_${body.receipt}`;
          return new Response(
            JSON.stringify({
              id: assignedOrderId,
              entity: "order",
              amount: 5000,
              currency: "USD",
              status: "created",
              created_at: 1700000000,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
        getPaymentResponse: (pId) => {
          return new Response(
            JSON.stringify({
              id: pId,
              entity: "payment",
              amount: 3000, // MISMATCH: 3000 vs expected 5000
              currency: "USD",
              status: "captured",
              order_id: assignedOrderId,
              method: "card",
              captured: true,
              created_at: 1700000000,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
      });

      const service = new ProviderPaymentService(provider);
      await service.createProviderOrder(
        db,
        storeId,
        localPayment.payment.id,
        localPayment.attempt.id,
      );

      const pmtId = "pay_MM_123";
      const validSig = computeValidSignature(assignedOrderId, pmtId);

      await expect(
        service.verifyAndProcessCallback(db, {
          storeId,
          paymentId: localPayment.payment.id,
          attemptId: localPayment.attempt.id,
          razorpayOrderId: assignedOrderId,
          razorpayPaymentId: pmtId,
          razorpaySignature: validSig,
        }),
      ).rejects.toThrow(PaymentAmountMismatchError);

      const pmtQuery = await db.query<{ status: string }>(
        `SELECT status FROM payments WHERE id = $1`,
        [localPayment.payment.id],
      );
      expect(pmtQuery.rows[0]?.status).toBe("REQUIRES_RECONCILIATION");
    });

    it("transitions payment to REQUIRES_RECONCILIATION if gateway currency mismatches", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "rzp-cb-currmismatch");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      let assignedOrderId = "";
      const { provider } = createMockProvider({
        createOrderResponse: (body) => {
          assignedOrderId = `order_CURR_${body.receipt}`;
          return new Response(
            JSON.stringify({
              id: assignedOrderId,
              entity: "order",
              amount: 5000,
              currency: "USD",
              status: "created",
              created_at: 1700000000,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
        getPaymentResponse: (pId) => {
          return new Response(
            JSON.stringify({
              id: pId,
              entity: "payment",
              amount: 5000,
              currency: "EUR", // MISMATCH: EUR vs USD
              status: "captured",
              order_id: assignedOrderId,
              method: "card",
              captured: true,
              created_at: 1700000000,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
      });

      const service = new ProviderPaymentService(provider);
      await service.createProviderOrder(
        db,
        storeId,
        localPayment.payment.id,
        localPayment.attempt.id,
      );

      const pmtId = "pay_CURR_123";
      const validSig = computeValidSignature(assignedOrderId, pmtId);

      await expect(
        service.verifyAndProcessCallback(db, {
          storeId,
          paymentId: localPayment.payment.id,
          attemptId: localPayment.attempt.id,
          razorpayOrderId: assignedOrderId,
          razorpayPaymentId: pmtId,
          razorpaySignature: validSig,
        }),
      ).rejects.toThrow(PaymentCurrencyMismatchError);

      const pmtQuery = await db.query<{ status: string }>(
        `SELECT status FROM payments WHERE id = $1`,
        [localPayment.payment.id],
      );
      expect(pmtQuery.rows[0]?.status).toBe("REQUIRES_RECONCILIATION");
    });
  });

  describe("5. Stale Response Protection", () => {
    it("never regresses an already CAPTURED payment even if a delayed failed callback is received", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "rzp-stale-captured");
      const cartId = await seedTestCart(db, storeId);
      const checkoutId = await seedTestCheckout(db, storeId, cartId, 5000, "OPEN", "USD");

      const localPayment = await paymentService.createPayment(db, {
        storeId,
        checkoutId,
        provider: "razorpay",
        idempotencyKey: generateUuidV7(),
      });

      let assignedOrderId = "";
      let paymentGatewayStatus = "captured";

      const { provider } = createMockProvider({
        createOrderResponse: (body) => {
          assignedOrderId = `order_STALE_${body.receipt}`;
          return new Response(
            JSON.stringify({
              id: assignedOrderId,
              entity: "order",
              amount: 5000,
              currency: "USD",
              status: "created",
              created_at: 1700000000,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
        getPaymentResponse: (pId) => {
          return new Response(
            JSON.stringify({
              id: pId,
              entity: "payment",
              amount: 5000,
              currency: "USD",
              status: paymentGatewayStatus,
              order_id: assignedOrderId,
              method: "card",
              captured: paymentGatewayStatus === "captured",
              created_at: 1700000000,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
      });

      const service = new ProviderPaymentService(provider);
      await service.createProviderOrder(
        db,
        storeId,
        localPayment.payment.id,
        localPayment.attempt.id,
      );

      const pmtId = "pay_CAPTURE_1st";
      const validSig = computeValidSignature(assignedOrderId, pmtId);

      // First callback: captured successfully
      const firstResult = await service.verifyAndProcessCallback(db, {
        storeId,
        paymentId: localPayment.payment.id,
        attemptId: localPayment.attempt.id,
        razorpayOrderId: assignedOrderId,
        razorpayPaymentId: pmtId,
        razorpaySignature: validSig,
      });
      expect(firstResult.payment.status).toBe("CAPTURED");

      // Now simulated delayed/stale callback reporting failure
      paymentGatewayStatus = "failed";
      const secondResult = await service.verifyAndProcessCallback(db, {
        storeId,
        paymentId: localPayment.payment.id,
        attemptId: localPayment.attempt.id,
        razorpayOrderId: assignedOrderId,
        razorpayPaymentId: pmtId,
        razorpaySignature: validSig,
      });

      // Must remain CAPTURED - never regressed
      expect(secondResult.payment.status).toBe("CAPTURED");
      const pmtQuery = await db.query<{ status: string }>(
        `SELECT status FROM payments WHERE id = $1`,
        [localPayment.payment.id],
      );
      expect(pmtQuery.rows[0]?.status).toBe("CAPTURED");
    });
  });
});
