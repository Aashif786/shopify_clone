import { ApiHttpError } from "./errors";

export function extractIdempotencyKey(req: Request): string | null {
  const header =
    req.headers.get("idempotency-key") ||
    req.headers.get("Idempotency-Key");

  if (!header) {
    return null;
  }

  const trimmed = header.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > 255) {
    throw new ApiHttpError(
      400,
      "VALIDATION_ERROR",
      "Idempotency-Key must not exceed 255 characters",
      {
        fields: {
          "idempotency-key": "Header value must not exceed 255 characters",
        },
      }
    );
  }

  return trimmed;
}

export function requireIdempotencyKey(req: Request): string {
  const key = extractIdempotencyKey(req);
  if (!key) {
    throw new ApiHttpError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Key header is required for this operation"
    );
  }
  return key;
}
