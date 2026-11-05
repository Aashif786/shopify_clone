import { ReturnService } from "@calcart/returns";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  returnDecisionValidator,
  validateBody,
  validateUuid,
} from "@/lib/api";

const returnService = new ReturnService();

interface RouteContext {
  params: Promise<{ storeId: string; returnId: string }>;
}

/** Merchant rejects a requested return. */
export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId, returnId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(returnId, "returnId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "staff")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least staff role in this store",
      );
    }

    const body = await validateBody(req, returnDecisionValidator);

    const updated = await returnService.rejectReturnRequest(ctx.db, {
      storeId,
      returnRequestId: returnId,
      merchantNote: body.merchantNote ?? null,
      actorId: auth.user.id,
    });

    return apiSuccess(updated, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
