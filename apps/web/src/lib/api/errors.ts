import { NextResponse } from "next/server";
import type { ApiErrorResponse } from "@shopify-clone/types";
import type { ValidationError } from "@shopify-clone/validation";
import {
  AccountDisabledError,
  AuthenticationError,
  InvalidCredentialsError,
  SessionExpiredError,
  SessionRevokedError,
  UserAlreadyExistsError,
} from "@shopify-clone/auth";
import { ForbiddenError } from "@shopify-clone/tenant";
import { StoreDomainError } from "@shopify-clone/stores";
import { ProductDomainError } from "@shopify-clone/products";
import { InventoryDomainError } from "@shopify-clone/inventory";
import { CustomerDomainError } from "@shopify-clone/customers";
import { CartDomainError } from "@shopify-clone/carts";
import { apiError } from "./response";

export class ApiHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly fields?: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    options?: {
      details?: unknown;
      fields?: Record<string, string>;
    },
  ) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.code = code;
    this.details = options?.details;
    this.fields = options?.fields;
  }
}

export function isValidationErrorList(
  value: unknown,
): value is ValidationError[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === "object" &&
    value[0] !== null &&
    "field" in value[0] &&
    "message" in value[0]
  );
}

export function handleApiError(
  error: unknown,
  requestId?: string,
): NextResponse<ApiErrorResponse> {
  // 1. Explicit ApiHttpError
  if (error instanceof ApiHttpError) {
    return apiError(error.code, error.message, error.status, {
      requestId,
      details: error.details,
      fields: error.fields,
    });
  }

  // 2. Auth Foundation Errors
  if (error instanceof InvalidCredentialsError) {
    return apiError("INVALID_CREDENTIALS", "Invalid email or password", 401, {
      requestId,
    });
  }

  if (error instanceof AccountDisabledError) {
    return apiError(
      "ACCOUNT_DISABLED",
      "Account is inactive or disabled",
      403,
      { requestId },
    );
  }

  if (error instanceof SessionExpiredError) {
    return apiError(
      "AUTHENTICATION_REQUIRED",
      "Session has expired. Please log in again.",
      401,
      { requestId },
    );
  }

  if (error instanceof SessionRevokedError) {
    return apiError(
      "AUTHENTICATION_REQUIRED",
      "Session has been revoked. Please log in again.",
      401,
      { requestId },
    );
  }

  if (error instanceof UserAlreadyExistsError) {
    return apiError(
      "USER_ALREADY_EXISTS",
      "An account with this email already exists",
      409,
      { requestId },
    );
  }

  if (error instanceof AuthenticationError) {
    const isValidationType =
      error.code === "WEAK_PASSWORD" ||
      error.code === "INVALID_EMAIL" ||
      error.code === "INVALID_NAME";

    if (isValidationType) {
      return apiError("VALIDATION_ERROR", error.message, 400, {
        requestId,
        fields: {
          ...(error.code === "WEAK_PASSWORD"
            ? { password: error.message }
            : {}),
          ...(error.code === "INVALID_EMAIL" ? { email: error.message } : {}),
          ...(error.code === "INVALID_NAME" ? { name: error.message } : {}),
        },
      });
    }

    return apiError(
      error.code || "AUTHENTICATION_REQUIRED",
      error.message,
      401,
      { requestId },
    );
  }

  // 3. Tenant Foundation Errors
  if (error instanceof ForbiddenError) {
    return apiError(error.code || "FORBIDDEN", error.message, 403, {
      requestId,
    });
  }

  // 4. Store Domain Errors
  if (error instanceof StoreDomainError) {
    return apiError(error.code, error.message, error.status, {
      requestId,
      details: error.details,
    });
  }

  // 5. Product Domain Errors
  if (error instanceof ProductDomainError) {
    return apiError(error.code, error.message, error.status, {
      requestId,
      details: error.details,
    });
  }

  // 6. Inventory Domain Errors
  if (error instanceof InventoryDomainError) {
    return apiError(error.code, error.message, error.status, {
      requestId,
      details: error.details,
    });
  }

  // 7. Customer Domain Errors
  if (error instanceof CustomerDomainError) {
    return apiError(error.code, error.message, error.status, {
      requestId,
      details: error.details,
    });
  }

  // 8. Cart Domain Errors
  if (error instanceof CartDomainError) {
    return apiError(error.code, error.message, error.status, {
      requestId,
      details: error.details,
    });
  }

  // 4. Validation errors list
  if (isValidationErrorList(error)) {
    const fields: Record<string, string> = {};
    for (const err of error) {
      fields[err.field] = err.message;
    }
    return apiError("VALIDATION_ERROR", "Validation failed", 400, {
      requestId,
      fields,
      details: { errors: error },
    });
  }

  // 5. Malformed JSON Body
  if (error instanceof SyntaxError && "message" in error) {
    return apiError("VALIDATION_ERROR", "Malformed JSON request body", 400, {
      requestId,
    });
  }

  // 6. Unexpected internal errors - do not leak stack traces or internal details
  console.error(
    `[API_INTERNAL_ERROR] requestId=${requestId ?? "none"}:`,
    error instanceof Error ? (error.stack ?? error.message) : error,
  );

  return apiError("INTERNAL_ERROR", "An unexpected error occurred.", 500, {
    requestId,
  });
}
