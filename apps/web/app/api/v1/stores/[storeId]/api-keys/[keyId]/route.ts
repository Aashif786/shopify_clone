import { ApiKeyService } from "@calcart/auth";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const apiKeyService = new ApiKeyService();

interface RouteContext {
  params: Promise<{ storeId: string; keyId: string }>;
}

export async function DELETE(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, keyId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(keyId, "keyId");

    const member = await requireStoreOrNotFound(ctx, storeId, "admin");
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(403, "FORBIDDEN", "Admin permissions required to revoke API keys");
    }

    const revoked = await apiKeyService.revokeApiKey(ctx.db, storeId, keyId);
    if (!revoked) {
      throw new ApiHttpError(404, "NOT_FOUND", "API key not found or already revoked");
    }

    return apiSuccess({ revoked: true, key: revoked }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
