import { RefundService } from "@shopify-clone/payments";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import {
  ApiHttpError,
  apiSuccess,
  createRefundValidator,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
  validateUuid,
} from "@/lib/api";
import { tryGetRazorpayProvider } from "@/lib/payment-provider-helper";

const refundService = new RefundService();

interface RouteContext {
  params: Promise<{ storeId: string; orderId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId, orderId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(orderId, "orderId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, createRefundValidator);

    // Support Idempotency-Key from header or body
    const headerIdempotencyKey =
      req.headers.get("idempotency-key") ||
      req.headers.get("x-idempotency-key") ||
      undefined;
    const idempotencyKey =
      body.idempotencyKey ||
      (headerIdempotencyKey ? headerIdempotencyKey.trim() : undefined);

    const provider = tryGetRazorpayProvider();

    const result = await refundService.executeMerchantRefund(ctx.db, {
      storeId,
      orderId,
      amount: body.amount,
      reason: body.reason,
      idempotencyKey,
      actorType: "MERCHANT",
      actorId: auth.user.id,
      provider,
    });

    if (result.status === "FAILED") {
      throw new ApiHttpError(
        400,
        "REFUND_FAILED",
        result.error || "Refund request failed at payment gateway",
      );
    }

    return apiSuccess(result, { requestId, status: 201 });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, orderId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(orderId, "orderId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const summary = await refundService.getOrderRefundSummary(ctx.db, storeId, orderId);

    if (!summary) {
      return apiSuccess(
        {
          paymentId: null,
          orderId,
          currency: "USD",
          totalAmount: 0,
          capturedAmount: 0,
          refundedAmount: 0,
          remainingRefundable: 0,
          isRefundable: false,
          paymentStatus: "UNPAID",
          refunds: [],
        },
        { requestId },
      );
    }

    return apiSuccess(summary, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
