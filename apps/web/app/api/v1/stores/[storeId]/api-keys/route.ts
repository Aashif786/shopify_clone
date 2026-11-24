import { ApiKeyService } from "@calcart/auth";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
  validateUuid,
} from "@/lib/api";
import {
  type Validator,
  type ValidationResult,
  type ValidationError,
  validationFailure,
  validationSuccess,
} from "@calcart/validation";

const apiKeyService = new ApiKeyService();

const ALLOWED_API_KEY_SCOPES = [
  "read:products",
  "write:products",
  "read:orders",
  "write:orders",
  "read:inventory",
  "write:inventory",
  "read:webhooks",
  "write:webhooks",
] as const;

const ALLOWED_API_KEY_SCOPES_SET = new Set<string>(ALLOWED_API_KEY_SCOPES);

function sanitizeApiKey<T extends { key_hash?: string }>(key: T): Omit<T, "key_hash"> {
  const copy = { ...key };
  delete (copy as { key_hash?: string }).key_hash;
  return copy;
}

interface CreateApiKeyDto {
  name: string;
  scopes?: string[];
  expiresAt?: string | null;
}

const createApiKeyValidator: Validator<CreateApiKeyDto> = {
  validate(input: unknown): ValidationResult<CreateApiKeyDto> {
    if (!input || typeof input !== "object") {
      return validationFailure([{ field: "body", message: "Expected JSON object" }]);
    }
    const val = input as Record<string, unknown>;
    const errors: ValidationError[] = [];

    if (!val.name || typeof val.name !== "string" || !val.name.trim()) {
      errors.push({ field: "name", message: "Key name is required" });
    }

    let validatedScopes: string[] | undefined;
    if (val.scopes !== undefined) {
      if (!Array.isArray(val.scopes)) {
        errors.push({ field: "scopes", message: "Scopes must be an array of strings" });
      } else {
        const scopes = val.scopes.map(String);
        for (const scope of scopes) {
          if (!ALLOWED_API_KEY_SCOPES_SET.has(scope)) {
            errors.push({
              field: "scopes",
              message: `Invalid scope '${scope}'. Allowed scopes: ${ALLOWED_API_KEY_SCOPES.join(", ")}`,
            });
          }
        }
        validatedScopes = scopes;
      }
    }

    let validatedExpiresAt: string | null = null;
    if (val.expiresAt !== undefined && val.expiresAt !== null) {
      if (typeof val.expiresAt !== "string") {
        errors.push({ field: "expiresAt", message: "expiresAt must be a valid ISO timestamp string" });
      } else {
        const expDate = new Date(val.expiresAt);
        if (isNaN(expDate.getTime())) {
          errors.push({ field: "expiresAt", message: "Invalid expiresAt date format" });
        } else if (expDate.getTime() <= Date.now()) {
          errors.push({ field: "expiresAt", message: "expiresAt must be a future date" });
        } else {
          validatedExpiresAt = val.expiresAt;
        }
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      name: (val.name as string).trim(),
      scopes: validatedScopes,
      expiresAt: validatedExpiresAt,
    });
  },
};

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    await requireStoreOrNotFound(ctx, storeId, "admin");

    const keys = await apiKeyService.listStoreApiKeys(ctx.db, storeId);
    return apiSuccess(keys.map(sanitizeApiKey), { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    const member = await requireStoreOrNotFound(ctx, storeId, "admin");
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(403, "FORBIDDEN", "Admin permissions required to generate API keys");
    }

    const body = await validateBody(req, createApiKeyValidator);

    const { rawKey, record } = await apiKeyService.createApiKeyForStore(ctx.db, {
      storeId,
      name: body.name,
      scopes: body.scopes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      mode: "live",
    });

    return apiSuccess({ key: sanitizeApiKey(record), rawKey }, { status: 201, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
