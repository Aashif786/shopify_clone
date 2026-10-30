import { describe, expect, it, vi } from "vitest";
import {
  AccountDisabledError,
  AuthenticationError,
  InvalidCredentialsError,
  SessionExpiredError,
  SessionRevokedError,
  UserAlreadyExistsError,
} from "@calcart/auth";
import { ForbiddenError } from "@calcart/tenant";
import {
  ApiHttpError,
  apiError,
  apiNoContent,
  apiSuccess,
  decodeCursor,
  encodeCursor,
  extractIdempotencyKey,
  extractRequestId,
  handleApiError,
  parsePaginationParams,
  requireIdempotencyKey,
} from "@/lib/api/index.js";

describe("API Foundation Utilities", () => {
  describe("Response Envelope Helpers", () => {
    it("formats success response envelope with data, status, and requestId", async () => {
      const res = apiSuccess(
        { message: "hello" },
        { status: 201, requestId: "req_123" }
      );

      expect(res.status).toBe(201);
      expect(res.headers.get("x-request-id")).toBe("req_123");
      expect(res.headers.get("content-type")).toContain("application/json");

      const body = await res.json();
      expect(body).toEqual({
        success: true,
        data: { message: "hello" },
      });
    });

    it("formats error response envelope with code, message, and details", async () => {
      const res = apiError(
        "INVALID_INPUT",
        "The request input was invalid",
        400,
        {
          requestId: "req_456",
          details: { reason: "out_of_bounds" },
          fields: { amount: "Must be positive" },
        }
      );

      expect(res.status).toBe(400);
      expect(res.headers.get("x-request-id")).toBe("req_456");

      const body = await res.json();
      expect(body).toEqual({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "The request input was invalid",
          requestId: "req_456",
          details: { reason: "out_of_bounds" },
          fields: { amount: "Must be positive" },
        },
      });
    });

    it("formats 204 No Content response without body", () => {
      const res = apiNoContent({ requestId: "req_789" });
      expect(res.status).toBe(204);
      expect(res.headers.get("x-request-id")).toBe("req_789");
    });
  });

  describe("Error Mapping (handleApiError)", () => {
    it("maps InvalidCredentialsError to 401 INVALID_CREDENTIALS", async () => {
      const res = handleApiError(new InvalidCredentialsError(), "req_1");
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INVALID_CREDENTIALS");
      expect(body.error.message).toBe("Invalid email or password");
      expect(body.error.requestId).toBe("req_1");
    });

    it("maps AccountDisabledError to 403 ACCOUNT_DISABLED", async () => {
      const res = handleApiError(new AccountDisabledError(), "req_2");
      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body.error.code).toBe("ACCOUNT_DISABLED");
    });

    it("maps SessionExpiredError to 401 AUTHENTICATION_REQUIRED", async () => {
      const res = handleApiError(new SessionExpiredError(), "req_3");
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("maps SessionRevokedError to 401 AUTHENTICATION_REQUIRED", async () => {
      const res = handleApiError(new SessionRevokedError(), "req_4");
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("maps UserAlreadyExistsError to 409 USER_ALREADY_EXISTS", async () => {
      const res = handleApiError(new UserAlreadyExistsError(), "req_5");
      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body.error.code).toBe("USER_ALREADY_EXISTS");
    });

    it("maps ForbiddenError from tenant module to 403 FORBIDDEN", async () => {
      const res = handleApiError(
        new ForbiddenError("Operation requires owner role", "FORBIDDEN"),
        "req_6"
      );
      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toBe("Operation requires owner role");
    });

    it("maps AuthenticationError policy failure to 400 VALIDATION_ERROR with structured field details", async () => {
      const res = handleApiError(
        new AuthenticationError("Password must be at least 8 characters", "WEAK_PASSWORD"),
        "req_7"
      );
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.fields).toEqual({
        password: "Password must be at least 8 characters",
      });
    });

    it("maps validation error list to 400 VALIDATION_ERROR", async () => {
      const errors = [
        { field: "email", message: "Email is required" },
        { field: "name", message: "Name is required" },
      ];
      const res = handleApiError(errors, "req_8");
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.fields).toEqual({
        email: "Email is required",
        name: "Name is required",
      });
    });

    it("maps explicit ApiHttpError with custom status and code", async () => {
      const res = handleApiError(
        new ApiHttpError(404, "PRODUCT_NOT_FOUND", "Product does not exist", {
          details: { productId: "p_123" },
        }),
        "req_9"
      );
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error.code).toBe("PRODUCT_NOT_FOUND");
      expect(body.error.message).toBe("Product does not exist");
      expect(body.error.details).toEqual({ productId: "p_123" });
    });

    it("safely handles unexpected internal errors as 500 without leaking stack traces or internal messages", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const res = handleApiError(
          new Error("SECRET_INTERNAL_DB_PASSWORD_LEAK: syntax error in SQL query"),
          "req_secret"
        );
        expect(res.status).toBe(500);

        const body = await res.json();
        expect(body.error.code).toBe("INTERNAL_ERROR");
        expect(body.error.message).toBe("An unexpected error occurred.");
        expect(body.error.requestId).toBe("req_secret");
        expect(JSON.stringify(body)).not.toContain("SECRET_INTERNAL_DB_PASSWORD_LEAK");
        expect(JSON.stringify(body)).not.toContain("stack");

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("[API_INTERNAL_ERROR] requestId=req_secret:"),
          expect.anything()
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });

  describe("Pagination", () => {
    it("provides default limit (25) when no limit is supplied", () => {
      const params = parsePaginationParams(new URL("https://example.com/api/v1/items"));
      expect(params.limit).toBe(25);
      expect(params.cursor).toBeUndefined();
    });

    it("parses valid custom limit and cursor", () => {
      const params = parsePaginationParams(
        new URL("https://example.com/api/v1/items?limit=50&cursor=tok_123")
      );
      expect(params.limit).toBe(50);
      expect(params.cursor).toBe("tok_123");
    });

    it("rejects non-integer, zero, negative, or excessive limits with 400 VALIDATION_ERROR", () => {
      expect(() =>
        parsePaginationParams(new URL("https://example.com/api/v1/items?limit=0"))
      ).toThrowError(ApiHttpError);

      expect(() =>
        parsePaginationParams(new URL("https://example.com/api/v1/items?limit=-5"))
      ).toThrowError(ApiHttpError);

      expect(() =>
        parsePaginationParams(new URL("https://example.com/api/v1/items?limit=101"))
      ).toThrowError(ApiHttpError);

      expect(() =>
        parsePaginationParams(new URL("https://example.com/api/v1/items?limit=abc"))
      ).toThrowError(ApiHttpError);
    });

    it("encodes and decodes pagination cursor", () => {
      const payload = { id: "018d4567-89ab-7cde-8f01-23456789abcd", createdAt: "2026-10-08T00:00:00Z" };
      const encoded = encodeCursor(payload);
      expect(typeof encoded).toBe("string");

      const decoded = decodeCursor<typeof payload>(encoded);
      expect(decoded).toEqual(payload);
    });

    it("rejects malformed cursor with 400 VALIDATION_ERROR", () => {
      expect(() => decodeCursor("invalid-non-base64-json-%%%")).toThrowError(
        ApiHttpError
      );
    });
  });

  describe("Idempotency", () => {
    it("extracts and validates valid idempotency key", () => {
      const req = new Request("https://example.com/api/v1/payments", {
        headers: { "Idempotency-Key": "client-uuid-1234" },
      });
      expect(extractIdempotencyKey(req)).toBe("client-uuid-1234");
      expect(requireIdempotencyKey(req)).toBe("client-uuid-1234");
    });

    it("returns null when idempotency key is absent or empty", () => {
      const req = new Request("https://example.com/api/v1/payments");
      expect(extractIdempotencyKey(req)).toBeNull();
      expect(() => requireIdempotencyKey(req)).toThrowError(ApiHttpError);
    });

    it("rejects excessively long idempotency key exceeding 255 chars", () => {
      const tooLong = "a".repeat(256);
      const req = new Request("https://example.com/api/v1/payments", {
        headers: { "Idempotency-Key": tooLong },
      });
      expect(() => extractIdempotencyKey(req)).toThrowError(ApiHttpError);
    });
  });

  describe("Request ID", () => {
    it("preserves incoming valid x-request-id", () => {
      const req = new Request("https://example.com/api/v1/test", {
        headers: { "x-request-id": "client_req_999" },
      });
      expect(extractRequestId(req)).toBe("client_req_999");
    });

    it("generates a new UUIDv7 if x-request-id is omitted", () => {
      const req = new Request("https://example.com/api/v1/test");
      const generated = extractRequestId(req);
      expect(generated).toBeDefined();
      expect(generated.length).toBeGreaterThan(10);
    });
  });
});
