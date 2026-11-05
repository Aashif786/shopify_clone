import { ReturnService } from "@calcart/returns";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  updateReturnPolicyValidator,
  validateBody,
  validateUuid,
} from "@/lib/api";

const returnService = new ReturnService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

/** Current return policy. Falls back to the platform default when unset. */
export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const policy = await returnService.getReturnPolicy(ctx.db, storeId);
    return apiSuccess(policy, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

/** Updates the store's return window / enablement. */
export async function PATCH(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, updateReturnPolicyValidator);

    const policy = await returnService.updateReturnPolicy(ctx.db, storeId, {
      isReturnsEnabled: body.isReturnsEnabled,
      returnWindowDays: body.returnWindowDays,
    });

    return apiSuccess(policy, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
