import { ReturnService } from "@calcart/returns";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const returnService = new ReturnService();

interface RouteContext {
  params: Promise<{ storeId: string; returnId: string }>;
}

/** Full return request detail, including line items and the audit trail. */
export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, returnId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(returnId, "returnId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const returnRequest = await returnService.getReturnRequest(
      ctx.db,
      storeId,
      returnId,
    );
    if (!returnRequest) {
      throw new ApiHttpError(
        404,
        "RETURN_REQUEST_NOT_FOUND",
        "Return request not found",
      );
    }

    return apiSuccess(returnRequest, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
