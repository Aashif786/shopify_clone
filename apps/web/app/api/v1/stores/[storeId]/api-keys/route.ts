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
  validationFailure,
  validationSuccess,
} from "@calcart/validation";

const apiKeyService = new ApiKeyService();

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
    if (!val.name || typeof val.name !== "string" || !val.name.trim()) {
      return validationFailure([{ field: "name", message: "Key name is required" }]);
    }
    return validationSuccess({
      name: val.name.trim(),
      scopes: Array.isArray(val.scopes) ? val.scopes.map(String) : undefined,
      expiresAt: typeof val.expiresAt === "string" ? val.expiresAt : null,
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
    return apiSuccess(keys, { requestId });
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

    return apiSuccess({ key: record, rawKey }, { status: 201, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
