import { StoreService } from "@calcart/stores";
import {
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  updateStoreMemberValidator,
  validateBody,
} from "@/lib/api";

const storeService = new StoreService();

interface RouteContext {
  params: Promise<{ storeId: string; memberId: string }>;
}

export async function PATCH(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId, memberId } = await Promise.resolve(context.params);

    await requireStoreOrNotFound(ctx, storeId, "admin");
    const validated = await validateBody(req, updateStoreMemberValidator);
    const updated = await storeService.updateStoreMember(
      ctx.db,
      storeId,
      auth.user.id,
      memberId,
      validated,
    );

    return apiSuccess(updated, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId, memberId } = await Promise.resolve(context.params);

    await requireStoreOrNotFound(ctx, storeId, "admin");
    await storeService.removeStoreMember(
      ctx.db,
      storeId,
      auth.user.id,
      memberId,
    );

    return apiSuccess({ removed: true }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
