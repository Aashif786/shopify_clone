import { describe, expect, it } from "vitest";
import {
  type HttpTransport,
  RazorpayClient,
} from "../../modules/payments/src/infrastructure/razorpay-client.js";
import { RazorpayPaymentProvider } from "../../modules/payments/src/providers/razorpay-provider.js";
import {
  RazorpayApiError,
  RazorpayAuthenticationError,
  RazorpayNetworkError,
  RazorpayRateLimitError,
  RazorpayServerError,
  RazorpayTimeoutError,
} from "../../modules/payments/src/providers/razorpay-types.js";

describe("Razorpay Provider and Client Integration", () => {
  const testKeyId = "rzp_test_mockKeyId123";
  const testKeySecret = "mockKeySecret_superSecret456";

  interface RecordedRequest {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }

  function createMockTransport(
    handler: (req: RecordedRequest) => Promise<{ status: number; body: string; headers?: Record<string, string> }>,
  ): { transport: HttpTransport; requests: RecordedRequest[] } {
    const requests: RecordedRequest[] = [];

    const transport: HttpTransport = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const headersRecord: Record<string, string> = {};

      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((v, k) => {
            headersRecord[k] = v;
          });
        } else if (Array.isArray(init.headers)) {
          for (const [k, v] of init.headers) {
            headersRecord[k] = v;
          }
        } else {
          Object.assign(headersRecord, init.headers);
        }
      }

      const rec: RecordedRequest = {
        url,
        method: init?.method ?? "GET",
        headers: headersRecord,
        body: init?.body ? String(init.body) : undefined,
      };
      requests.push(rec);

      const res = await handler(rec);
      return new Response(res.body, {
        status: res.status,
        headers: { "Content-Type": "application/json", ...(res.headers ?? {}) },
      });
    };

    return { transport, requests };
  }

  describe("1. RazorpayClient HTTP Protocol and Contract", () => {
    it("sends correct POST request with Basic Auth and headers to /orders", async () => {
      const expectedExpectedCredentials = Buffer.from(`${testKeyId}:${testKeySecret}`).toString("base64");

      const { transport, requests } = createMockTransport(async (req) => {
        expect(req.url).toBe("https://api.razorpay.com/v1/orders");
        expect(req.method).toBe("POST");
        expect(req.headers?.Authorization).toBe(`Basic ${expectedExpectedCredentials}`);
        expect(req.headers?.["Content-Type"]).toBe("application/json");
        expect(req.headers?.Accept).toBe("application/json");

        const parsedBody = JSON.parse(req.body!);
        expect(parsedBody.amount).toBe(5000);
        expect(parsedBody.currency).toBe("USD");
        expect(parsedBody.receipt).toBe("rcpt_12345");

        return {
          status: 200,
          body: JSON.stringify({
            id: "order_MOCK_1",
            entity: "order",
            amount: 5000,
            amount_paid: 0,
            amount_due: 5000,
            currency: "USD",
            receipt: "rcpt_12345",
            status: "created",
            attempts: 0,
            created_at: 1700000000,
          }),
        };
      });

      const client = new RazorpayClient({
        keyId: testKeyId,
        keySecret: testKeySecret,
        transport,
      });

      const order = await client.createOrder({
        amount: 5000,
        currency: "USD",
        receipt: "rcpt_12345",
        payment_capture: 1,
      });

      expect(requests.length).toBe(1);
      expect(order.id).toBe("order_MOCK_1");
      expect(order.amount).toBe(5000);
      expect(order.status).toBe("created");
    });

    it("sends correct GET request with Basic Auth to /payments/:id", async () => {
      const { transport, requests } = createMockTransport(async (req) => {
        expect(req.url).toBe("https://api.razorpay.com/v1/payments/pay_MOCK_99");
        expect(req.method).toBe("GET");
        return {
          status: 200,
          body: JSON.stringify({
            id: "pay_MOCK_99",
            entity: "payment",
            amount: 5000,
            currency: "USD",
            status: "captured",
            order_id: "order_MOCK_1",
            method: "card",
            captured: true,
            created_at: 1700000010,
          }),
        };
      });

      const client = new RazorpayClient({
        keyId: testKeyId,
        keySecret: testKeySecret,
        transport,
      });

      const payment = await client.getPayment("pay_MOCK_99");
      expect(requests.length).toBe(1);
      expect(payment.id).toBe("pay_MOCK_99");
      expect(payment.status).toBe("captured");
      expect(payment.captured).toBe(true);
    });
  });

  describe("2. Error Normalization & Error Categories", () => {
    it("maps HTTP 401 to RazorpayAuthenticationError", async () => {
      const { transport } = createMockTransport(async () => ({
        status: 401,
        body: JSON.stringify({
          error: {
            code: "BAD_REQUEST_ERROR",
            description: "The provided credentials are not valid.",
          },
        }),
      }));

      const client = new RazorpayClient({ keyId: testKeyId, keySecret: testKeySecret, transport });
      await expect(client.createOrder({ amount: 100, currency: "USD", receipt: "r1" })).rejects.toThrow(
        RazorpayAuthenticationError,
      );
    });

    it("maps HTTP 429 to RazorpayRateLimitError", async () => {
      const { transport } = createMockTransport(async () => ({
        status: 429,
        body: JSON.stringify({
          error: {
            code: "BAD_REQUEST_ERROR",
            description: "Rate limit exceeded",
          },
        }),
      }));

      const client = new RazorpayClient({ keyId: testKeyId, keySecret: testKeySecret, transport });
      await expect(client.createOrder({ amount: 100, currency: "USD", receipt: "r1" })).rejects.toThrow(
        RazorpayRateLimitError,
      );
    });

    it("maps HTTP 5xx to RazorpayServerError", async () => {
      const { transport } = createMockTransport(async () => ({
        status: 503,
        body: JSON.stringify({
          error: {
            code: "GATEWAY_ERROR",
            description: "Service unavailable",
          },
        }),
      }));

      const client = new RazorpayClient({ keyId: testKeyId, keySecret: testKeySecret, transport });
      await expect(client.createOrder({ amount: 100, currency: "USD", receipt: "r1" })).rejects.toThrow(
        RazorpayServerError,
      );
    });

    it("maps HTTP 400 with API error details to RazorpayApiError", async () => {
      const { transport } = createMockTransport(async () => ({
        status: 400,
        body: JSON.stringify({
          error: {
            code: "BAD_REQUEST_ERROR",
            description: "amount exceeds maximum limit",
            field: "amount",
          },
        }),
      }));

      const client = new RazorpayClient({ keyId: testKeyId, keySecret: testKeySecret, transport });
      await expect(client.createOrder({ amount: 100, currency: "USD", receipt: "r1" })).rejects.toThrow(
        RazorpayApiError,
      );
    });

    it("maps malformed non-JSON HTTP 200 response to RazorpayServerError", async () => {
      const { transport } = createMockTransport(async () => ({
        status: 200,
        body: "<html><body>Gateway 502 Bad Gateway proxy error</body></html>",
      }));

      const client = new RazorpayClient({ keyId: testKeyId, keySecret: testKeySecret, transport });
      await expect(client.createOrder({ amount: 100, currency: "USD", receipt: "r1" })).rejects.toThrow(
        RazorpayServerError,
      );
    });

    it("maps request timeout to RazorpayTimeoutError", async () => {
      const transport: HttpTransport = async (_input, init) => {
        // Wait until abort signal fires
        return new Promise((_resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              const err = new Error("This operation was aborted");
              err.name = "AbortError";
              reject(err);
            });
          }
        });
      };

      const client = new RazorpayClient({
        keyId: testKeyId,
        keySecret: testKeySecret,
        timeoutMs: 20, // very small timeout for fast test
        transport,
      });

      await expect(client.createOrder({ amount: 100, currency: "USD", receipt: "r1" })).rejects.toThrow(
        RazorpayTimeoutError,
      );
    });

    it("maps network connection drop to RazorpayNetworkError", async () => {
      const transport: HttpTransport = async () => {
        throw new Error("ECONNREFUSED connect ECONNREFUSED 127.0.0.1:443");
      };

      const client = new RazorpayClient({ keyId: testKeyId, keySecret: testKeySecret, transport });
      await expect(client.createOrder({ amount: 100, currency: "USD", receipt: "r1" })).rejects.toThrow(
        RazorpayNetworkError,
      );
    });
  });

  describe("3. Sensitive Data Redaction", () => {
    it("never includes keySecret or Basic Auth in network error messages", async () => {
      const transport: HttpTransport = async () => {
        throw new Error(`Failed to send request with key ${testKeySecret} and Basic MOCK_AUTH`);
      };

      const client = new RazorpayClient({ keyId: testKeyId, keySecret: testKeySecret, transport });

      try {
        await client.createOrder({ amount: 100, currency: "USD", receipt: "r1" });
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(RazorpayNetworkError);
        const errMsg = (err as Error).message;
        expect(errMsg).not.toContain(testKeySecret);
        expect(errMsg).toContain("[REDACTED]");
      }
    });
  });

  describe("4. RazorpayPaymentProvider Adapter", () => {
    it("validates constructor credentials", () => {
      expect(() => new RazorpayPaymentProvider({ keyId: "", keySecret: testKeySecret })).toThrow(
        "Razorpay keyId is required",
      );
      expect(() => new RazorpayPaymentProvider({ keyId: testKeyId, keySecret: "  " })).toThrow(
        "Razorpay keySecret is required",
      );
    });

    it("validates integer minor-unit amount and ISO currency before calling client", async () => {
      const { transport } = createMockTransport(async () => ({
        status: 200,
        body: JSON.stringify({ id: "order_1", entity: "order", amount: 100, currency: "USD", status: "created", created_at: 1 }),
      }));

      const client = new RazorpayClient({ keyId: testKeyId, keySecret: testKeySecret, transport });
      const provider = new RazorpayPaymentProvider({ keyId: testKeyId, keySecret: testKeySecret, client });

      // Non-integer amount
      await expect(
        provider.createOrder({
          paymentId: "p1",
          attemptId: "a1",
          storeId: "s1",
          amount: 49.99,
          currency: "USD",
          receipt: "r1",
        }),
      ).rejects.toThrow("Order amount must be a positive integer");

      // Non-positive amount
      await expect(
        provider.createOrder({
          paymentId: "p1",
          attemptId: "a1",
          storeId: "s1",
          amount: 0,
          currency: "USD",
          receipt: "r1",
        }),
      ).rejects.toThrow("Order amount must be a positive integer");

      // Invalid currency
      await expect(
        provider.createOrder({
          paymentId: "p1",
          attemptId: "a1",
          storeId: "s1",
          amount: 5000,
          currency: "usd", // lowercase
          receipt: "r1",
        }),
      ).rejects.toThrow("Order currency must be a valid 3-letter ISO code");
    });

    it("truncates receipt to 40 characters and creates order", async () => {
      let capturedReceipt: string | undefined;

      const { transport } = createMockTransport(async (req) => {
        const body = JSON.parse(req.body!);
        capturedReceipt = body.receipt;
        return {
          status: 200,
          body: JSON.stringify({
            id: "order_RZP_CREATED",
            entity: "order",
            amount: 7500,
            amount_paid: 0,
            amount_due: 7500,
            currency: "USD",
            receipt: capturedReceipt,
            status: "created",
            attempts: 0,
            created_at: 1700000000,
          }),
        };
      });

      const client = new RazorpayClient({ keyId: testKeyId, keySecret: testKeySecret, transport });
      const provider = new RazorpayPaymentProvider({ keyId: testKeyId, keySecret: testKeySecret, client });

      const longReceipt = "01927705-7f3c-7000-8000-000000000000_extra_very_long_receipt_id";
      const result = await provider.createOrder({
        paymentId: "pay_loc_1",
        attemptId: "att_loc_1",
        storeId: "st_1",
        amount: 7500,
        currency: "USD",
        receipt: longReceipt,
      });

      expect(capturedReceipt).toBeDefined();
      expect(capturedReceipt!.length).toBeLessThanOrEqual(40);
      expect(result.providerOrderId).toBe("order_RZP_CREATED");
      expect(result.amount).toBe(7500);
      expect(result.currency).toBe("USD");
      expect(result.status).toBe("created");
    });

    it("retrieves payment status details via getPayment", async () => {
      const { transport } = createMockTransport(async () => ({
        status: 200,
        body: JSON.stringify({
          id: "pay_RZP_CAPTURED",
          entity: "payment",
          amount: 8000,
          currency: "INR",
          status: "captured",
          order_id: "order_RZP_ORD",
          method: "upi",
          captured: true,
          created_at: 1700000000,
        }),
      }));

      const client = new RazorpayClient({ keyId: testKeyId, keySecret: testKeySecret, transport });
      const provider = new RazorpayPaymentProvider({ keyId: testKeyId, keySecret: testKeySecret, client });

      const payment = await provider.getPayment("pay_RZP_CAPTURED");
      expect(payment.providerPaymentId).toBe("pay_RZP_CAPTURED");
      expect(payment.providerOrderId).toBe("order_RZP_ORD");
      expect(payment.amount).toBe(8000);
      expect(payment.currency).toBe("INR");
      expect(payment.status).toBe("captured");
      expect(payment.captured).toBe(true);
      expect(payment.method).toBe("upi");
    });
  });
});
