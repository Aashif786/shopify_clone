import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateUuidV7 } from "@calcart/db";
import { Order, OrderService, ShipmentService } from "@calcart/orders";
import {
  PaymentCheckoutCoordinator,
  PaymentService,
  computeRazorpayWebhookSignature,
} from "@calcart/payments";
import { handleRazorpayWebhook } from "../../apps/web/app/api/v1/webhooks/payments/razorpay/handler.js";
import { POST as storeWebhookPost } from "../../apps/web/app/api/v1/webhooks/payments/razorpay/[storeId]/route.js";
import { globalEventBus } from "@calcart/event-bus";

describe("Phase 2 P0 Security & Financial Correctness Tests", () => {
  const storeId = generateUuidV7();
  const orderId = generateUuidV7();
  const checkoutId = generateUuidV7();

  describe("1. Tax-Inclusive (MRP) Order Creation", () => {
    it("successfully creates Order aggregate when pricesIncludeTax is true without OrderTotalsMismatchError", () => {
      // Subtotal 10000, Tax 1800 (inclusive), Shipping 500, Discount 1000
      // When pricesIncludeTax is true, total = subtotal - discount + shipping + 0 = 9500 (tax already inside subtotal)
      const order = new Order({
        storeId,
        orderNumber: "ORD-MRP-001",
        currency: "INR",
        subtotal: 10000,
        taxTotal: 1800,
        shippingTotal: 500,
        discountTotal: 1000,
        pricesIncludeTax: true,
        total: 9500,
        grandTotal: 9500,
      });

      expect(order.total).toBe(9500);
      expect(order.pricesIncludeTax).toBe(true);
      expect(order.taxTotal).toBe(1800);
    });

    it("creates Order aggregate when pricesIncludeTax is false (tax exclusive)", () => {
      // Subtotal 10000, Tax 1800 (exclusive), Shipping 500, Discount 1000
      // Total = 10000 - 1000 + 500 + 1800 = 11300
      const order = new Order({
        storeId,
        orderNumber: "ORD-EXCL-001",
        currency: "USD",
        subtotal: 10000,
        taxTotal: 1800,
        shippingTotal: 500,
        discountTotal: 1000,
        pricesIncludeTax: false,
        total: 11300,
        grandTotal: 11300,
      });

      expect(order.total).toBe(11300);
      expect(order.pricesIncludeTax).toBe(false);
    });

    it("OrderService.createOrderFromCheckout passes pricesIncludeTax to Order", async () => {
      const mockDb = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("INSERT INTO orders")) {
            return Promise.resolve({
              rows: [{ id: generateUuidV7(), order_number: "ORD-1" }],
            });
          }
          if (sql.includes("INSERT INTO order_items")) {
            return Promise.resolve({ rows: [{ id: generateUuidV7() }] });
          }
          if (sql.includes("INSERT INTO order_addresses")) {
            return Promise.resolve({ rows: [{ id: generateUuidV7() }] });
          }
          if (sql.includes("INSERT INTO order_status_history")) {
            return Promise.resolve({ rows: [{ id: generateUuidV7() }] });
          }
          if (sql.includes("SELECT store_id, order_number FROM orders")) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
      };

      const orderService = new OrderService();
      const variantId = generateUuidV7();

      const createdOrder = await orderService.createOrderFromCheckout(mockDb as any, {
        storeId,
        checkout: {
          id: checkoutId,
          storeId,
          currency: "INR",
          subtotal: 10000,
          discountTotal: 1000,
          shippingTotal: 500,
          taxTotal: 1800,
          total: 9500,
          pricesIncludeTax: true,
          items: [
            {
              id: generateUuidV7(),
              checkoutId,
              storeId,
              variantId,
              productNameSnapshot: "MRP Product",
              variantNameSnapshot: "Standard Variant",
              skuSnapshot: "MRP-1",
              quantity: 2,
              unitPrice: 5000,
              totalPrice: 10000,
            },
          ],
        },
      });

      expect(createdOrder).toBeDefined();
      expect(createdOrder.total).toBe(9500);
      expect(createdOrder.taxTotal).toBe(1800);
      expect(createdOrder.currency).toBe("INR");
    });
  });

  describe("2. Partial Gift Card & Store Credit Deduction", () => {
    it("PaymentCheckoutCoordinator subtracts applied gift cards and store credit from payable amount", async () => {
      const mockPaymentRepo = {
        findActiveByCheckoutId: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((_tx, p) =>
          Promise.resolve({
            ...p,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      };
      const mockAttemptRepo = {
        create: vi.fn().mockImplementation((_tx, a) =>
          Promise.resolve({
            ...a,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        findByPaymentId: vi.fn().mockResolvedValue([]),
      };
      const mockIdempotencyRepo = {
        reserve: vi.fn().mockResolvedValue({ reserved: true }),
        complete: vi.fn().mockResolvedValue(undefined),
      };
      const mockCheckoutRepo = {
        findWithItems: vi.fn().mockResolvedValue({
          id: checkoutId,
          storeId,
          cartId: generateUuidV7(),
          customerId: null,
          email: null,
          status: "PAYMENT_PENDING",
          currency: "USD",
          subtotal: 10000,
          discountTotal: 0,
          taxTotal: 500,
          shippingTotal: 500,
          total: 11000,
          paymentStatus: "PENDING",
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [],
        }),
      };
      const mockTaxService = {
        assertCheckoutTaxCurrent: vi.fn().mockResolvedValue(undefined),
      };
      const mockShippingService = {
        assertCheckoutShippingCurrent: vi.fn().mockResolvedValue(undefined),
      };

      const coordinator = new PaymentCheckoutCoordinator(
        mockPaymentRepo as any,
        mockAttemptRepo as any,
        mockIdempotencyRepo as any,
        mockCheckoutRepo as any,
        mockTaxService as any,
        mockShippingService as any,
      );

      const mockDb = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("FROM checkouts") && sql.includes("FOR UPDATE")) {
            return Promise.resolve({
              rows: [
                {
                  id: checkoutId,
                  store_id: storeId,
                  subtotal: 10000,
                  discount_total: 0,
                  tax_total: 500,
                  shipping_total: 500,
                  total: 11000,
                  currency: "USD",
                  status: "OPEN",
                  payment_status: "PENDING",
                  expires_at: null,
                },
              ],
            });
          }
          if (sql.includes("FROM checkout_gift_cards")) {
            return Promise.resolve({ rows: [{ total: 4000 }] });
          }
          if (sql.includes("FROM checkout_store_credits")) {
            return Promise.resolve({ rows: [{ total: 2000 }] });
          }
          if (sql.includes("UPDATE checkouts")) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
      };

      // Total = 11000 - 4000 (gift card) - 2000 (store credit) = 5000 payable to gateway
      const result = await coordinator.initializePaymentForCheckout(mockDb as any, {
        storeId,
        checkoutId,
        provider: "razorpay",
      });

      expect(result.payment.amount).toBe(5000);
      expect(result.attempt.amount).toBe(5000);
      expect(mockShippingService.assertCheckoutShippingCurrent).toHaveBeenCalled();
      expect(mockTaxService.assertCheckoutTaxCurrent).toHaveBeenCalled();
    });

    it("PaymentCheckoutCoordinator fails closed if tax calculation is stale", async () => {
      const mockPaymentRepo = { findActiveByCheckoutId: vi.fn() };
      const mockAttemptRepo = { create: vi.fn() };
      const mockIdempotencyRepo = { reserve: vi.fn().mockResolvedValue({ reserved: true }) };
      const mockCheckoutRepo = { findWithItems: vi.fn() };
      const mockTaxService = {
        assertCheckoutTaxCurrent: vi.fn().mockRejectedValue(new Error("TAX_CALCULATION_STALE")),
      };
      const mockShippingService = {
        assertCheckoutShippingCurrent: vi.fn().mockResolvedValue(undefined),
      };

      const coordinator = new PaymentCheckoutCoordinator(
        mockPaymentRepo as any,
        mockAttemptRepo as any,
        mockIdempotencyRepo as any,
        mockCheckoutRepo as any,
        mockTaxService as any,
        mockShippingService as any,
      );

      const mockDb = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("FROM checkouts") && sql.includes("FOR UPDATE")) {
            return Promise.resolve({
              rows: [
                {
                  id: checkoutId,
                  store_id: storeId,
                  subtotal: 10000,
                  discount_total: 0,
                  tax_total: 0,
                  shipping_total: 0,
                  total: 10000,
                  currency: "USD",
                  status: "OPEN",
                  payment_status: "PENDING",
                  expires_at: null,
                },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
      };

      await expect(
        coordinator.initializePaymentForCheckout(mockDb as any, {
          storeId,
          checkoutId,
        }),
      ).rejects.toThrow("TAX_CALCULATION_STALE");
    });

    it("PaymentService.createPayment computes authoritative payableTotal after gift cards & store credit", async () => {
      const mockPaymentRepo = {
        findActiveByCheckoutId: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((_tx, p) =>
          Promise.resolve({
            ...p,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      };
      const mockAttemptRepo = {
        create: vi.fn().mockImplementation((_tx, a) =>
          Promise.resolve({
            ...a,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      };
      const mockIdempotencyRepo = {
        reserve: vi.fn().mockResolvedValue({ reserved: true }),
        complete: vi.fn().mockResolvedValue(undefined),
      };
      const mockTaxService = {
        assertCheckoutTaxCurrent: vi.fn().mockResolvedValue(undefined),
      };
      const mockShippingService = {
        assertCheckoutShippingCurrent: vi.fn().mockResolvedValue(undefined),
      };

      const paymentService = new PaymentService(
        mockPaymentRepo as any,
        mockAttemptRepo as any,
        mockIdempotencyRepo as any,
        mockTaxService as any,
        mockShippingService as any,
      );

      const mockDb = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("FROM checkouts") && sql.includes("FOR UPDATE")) {
            return Promise.resolve({
              rows: [
                {
                  id: checkoutId,
                  store_id: storeId,
                  subtotal: 20000,
                  discount_total: 0,
                  tax_total: 0,
                  shipping_total: 0,
                  total: 20000,
                  currency: "INR",
                  status: "OPEN",
                  payment_status: "PENDING",
                  expires_at: null,
                },
              ],
            });
          }
          if (sql.includes("FROM checkout_gift_cards")) {
            return Promise.resolve({ rows: [{ total: 5000 }] });
          }
          if (sql.includes("FROM checkout_store_credits")) {
            return Promise.resolve({ rows: [{ total: 3000 }] });
          }
          if (sql.includes("UPDATE checkouts")) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
      };

      // Total = 20000 - 5000 - 3000 = 12000
      const result = await paymentService.createPayment(mockDb as any, {
        storeId,
        checkoutId,
        idempotencyKey: "idem_gc_sc_1",
      });

      expect(result.payment.amount).toBe(12000);
      expect(result.attempt.amount).toBe(12000);
    });
  });

  describe("3. ShipmentService Delivery State Transitions & Event Publishing", () => {
    it("markDelivered transitions a SHIPPED order to DELIVERED without crashing", async () => {
      const mockCarrier = { dispatch: vi.fn() };
      const mockLifecycle = {
        transition: vi.fn().mockResolvedValue({
          id: orderId,
          storeId,
          orderNumber: "ORD-DELIV-1",
          status: "DELIVERED",
          paymentStatus: "PAID",
        }),
      };
      const mockOrders = {
        getOrderById: vi.fn().mockResolvedValue({
          id: orderId,
          storeId,
          orderNumber: "ORD-DELIV-1",
          status: "SHIPPED",
          paymentStatus: "PAID",
        }),
      };

      const shipmentService = new ShipmentService(
        mockCarrier as any,
        mockLifecycle as any,
        mockOrders as any,
      );

      const publishSpy = vi.spyOn(globalEventBus, "publish");

      const mockDb = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("FROM shipments") && sql.includes("FOR UPDATE")) {
            return Promise.resolve({
              rows: [
                {
                  id: "ship_1",
                  store_id: storeId,
                  order_id: orderId,
                  status: "DISPATCHED",
                  carrier_name: "FedEx",
                  tracking_number: "FX123456",
                  tracking_url: null,
                  carrier_status: "In Transit",
                  created_at: new Date(),
                  updated_at: new Date(),
                },
              ],
            });
          }
          if (sql.includes("UPDATE shipments")) {
            return Promise.resolve({
              rows: [
                {
                  id: "ship_1",
                  store_id: storeId,
                  order_id: orderId,
                  status: "DELIVERED",
                  carrier_name: "FedEx",
                  tracking_number: "FX123456",
                  tracking_url: null,
                  carrier_status: "Delivered",
                  created_at: new Date(),
                  updated_at: new Date(),
                },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
      };

      const result = await shipmentService.markDelivered(mockDb as any, {
        storeId,
        orderId,
        actorType: "MERCHANT",
        reason: "Customer verified delivery",
      });

      expect(result.order.status).toBe("DELIVERED");
      expect(result.shipment.status).toBe("DELIVERED");
      expect(mockLifecycle.transition).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          storeId,
          orderId,
          toStatus: "DELIVERED",
        }),
      );
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "shipment.delivered",
          payload: expect.objectContaining({
            storeId,
            orderId,
            shipmentId: "ship_1",
          }),
        }),
      );
    });
  });

  describe("4. Multi-Store Razorpay Webhook Signature Verification", () => {
    const originalEnvSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    beforeEach(() => {
      process.env.RAZORPAY_WEBHOOK_SECRET = "global_razorpay_webhook_secret_999";
    });

    afterEach(() => {
      process.env.RAZORPAY_WEBHOOK_SECRET = originalEnvSecret;
    });

    it("verifies webhook using store-specific webhook_secret when store has custom credentials", async () => {
      const storeCustomSecret = "store_custom_wh_secret_777";
      const customStoreId = generateUuidV7();

      const payload = {
        entity: "event",
        account_id: "acc_12345",
        event: "order.paid", // Valid event shape parsed and ignored cleanly
        contains: ["order"],
        created_at: Math.floor(Date.now() / 1000),
        notes: {
          store_id: customStoreId,
        },
        payload: {
          order: {
            entity: {
              id: "order_test_12345",
              amount: 5000,
            },
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = computeRazorpayWebhookSignature(rawBody, storeCustomSecret);

      const mockDb = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("FROM store_payment_gateways")) {
            return Promise.resolve({
              rows: [
                {
                  id: "gw-custom",
                  store_id: customStoreId,
                  provider: "RAZORPAY",
                  key_id: "rzp_live_custom123",
                  key_secret: "secret_custom123",
                  webhook_secret: storeCustomSecret,
                  is_enabled: true,
                },
              ],
            });
          }
          if (sql.includes("INSERT INTO payment_webhook_events")) {
            return Promise.resolve({ rows: [{ id: generateUuidV7() }] });
          }
          if (sql.includes("FROM payments")) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
      };

      const req = new Request("http://localhost:3000/api/v1/webhooks/payments/razorpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": signature,
        },
        body: rawBody,
      });

      const res = await handleRazorpayWebhook(req, { db: mockDb as any });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.received).toBe(true);
    });

    it("rejects webhook with HTTP 400 when signature does not match store-specific webhook_secret", async () => {
      const storeCustomSecret = "store_custom_wh_secret_777";
      const customStoreId = generateUuidV7();

      const payload = {
        entity: "event",
        account_id: "acc_12345",
        event: "order.paid",
        contains: ["order"],
        created_at: Math.floor(Date.now() / 1000),
        notes: {
          store_id: customStoreId,
        },
        payload: {
          order: {
            entity: {
              id: "order_test_12345",
              amount: 5000,
            },
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      // Generate invalid signature using wrong secret
      const invalidSignature = computeRazorpayWebhookSignature(rawBody, "wrong_secret_123");

      const mockDb = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("FROM store_payment_gateways")) {
            return Promise.resolve({
              rows: [
                {
                  id: "gw-custom",
                  store_id: customStoreId,
                  provider: "RAZORPAY",
                  webhook_secret: storeCustomSecret,
                  is_enabled: true,
                },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
      };

      const req = new Request("http://localhost:3000/api/v1/webhooks/payments/razorpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": invalidSignature,
        },
        body: rawBody,
      });

      const res = await handleRazorpayWebhook(req, { db: mockDb as any });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid Razorpay webhook signature");
    });

    it("dedicated store-scoped webhook route verifies signature and validates UUID", async () => {
      // 1. Invalid UUID returns 400
      const badReq = new Request("http://localhost:3000/api/v1/webhooks/payments/razorpay/not-a-uuid", {
        method: "POST",
        body: "{}",
      });
      const badRes = await storeWebhookPost(badReq, {
        params: Promise.resolve({ storeId: "not-a-uuid" }),
      });
      expect(badRes.status).toBe(400);

      // 2. Valid UUID passes through to store-scoped webhook handler
      const targetStoreId = generateUuidV7();
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };
      const validReq = new Request(
        `http://localhost:3000/api/v1/webhooks/payments/razorpay/${targetStoreId}`,
        {
          method: "POST",
          headers: {
            "x-razorpay-signature": "some_sig",
          },
          body: JSON.stringify({
            entity: "event",
            event: "order.paid",
            contains: ["order"],
            created_at: 1700000000,
            payload: { order: { entity: { id: "ord_1" } } },
          }),
        },
      );
      const res = await storeWebhookPost(
        validReq,
        {
          params: Promise.resolve({ storeId: targetStoreId }),
        },
        { db: mockDb as any },
      );
      // Will return 400 for bad signature, which confirms validation passed and verification ran
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid Razorpay webhook signature");
    });
  });
});
