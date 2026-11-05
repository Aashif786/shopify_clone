import {
  ReturnService,
  isValidReturnRequestStatus,
  type ReturnRequestStatus,
} from "@calcart/returns";
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
  params: Promise<{ storeId: string }>;
}

/** Merchant return review queue, filterable by status. */
export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const url = new URL(req.url);
    const rawStatus = url.searchParams.get("status");
    let status: ReturnRequestStatus | null = null;
    if (rawStatus) {
      if (!isValidReturnRequestStatus(rawStatus)) {
        throw new ApiHttpError(
          400,
          "VALIDATION_ERROR",
          "status must be one of REQUESTED, APPROVED, REJECTED, RECEIVED, REFUNDED, CANCELLED",
        );
      }
      status = rawStatus;
    }

    const orderIdParam = url.searchParams.get("orderId");
    if (orderIdParam) {
      validateUuid(orderIdParam, "orderId");
    }

    const limitParam = Number(url.searchParams.get("limit") ?? "25");
    const offsetParam = Number(url.searchParams.get("offset") ?? "0");

    const result = await returnService.listReturnRequests(ctx.db, {
      storeId,
      status,
      orderId: orderIdParam ?? null,
      limit: Number.isFinite(limitParam) ? limitParam : 25,
      offset: Number.isFinite(offsetParam) ? offsetParam : 0,
    });

    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
