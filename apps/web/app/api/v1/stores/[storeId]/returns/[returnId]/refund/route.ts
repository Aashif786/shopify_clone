import { RefundService } from "@calcart/payments";
import { ReturnService } from "@calcart/returns";
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
import { tryGetRazorpayProvider } from "@/lib/payment-provider-helper";

const returnService = new ReturnService();
const refundService = new RefundService();

interface RouteContext {
  params: Promise<{ storeId: string; returnId: string }>;
}

/**
 * Issues the refund for a received return.
 *
 * No client idempotency key is accepted: the key is derived deterministically
 * from the return request id inside `ReturnService`, so retries and concurrent
 * clicks replay the same refund rather than charging the merchant twice.
 */
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
    // Matches the order refund route: moving money requires admin.
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const provider = tryGetRazorpayProvider();

    const result = await returnService.refundReturnRequest(
      ctx.db,
      refundService,
      {
        storeId,
        returnRequestId: returnId,
        actorId: auth.user.id,
        provider,
      },
    );

    if (result.refundStatus !== "SUCCEEDED") {
      throw new ApiHttpError(
        400,
        "REFUND_FAILED",
        result.error || "Refund request failed at payment gateway",
        { details: { returnRequest: result.returnRequest } },
      );
    }

    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
