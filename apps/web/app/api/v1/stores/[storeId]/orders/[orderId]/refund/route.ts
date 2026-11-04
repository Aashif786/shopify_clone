import { RefundService } from "@calcart/payments";
import { hasRoleAtLeast } from "@calcart/tenant";
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
import { extractIdempotencyKey } from "@/lib/api/idempotency";
import { tryGetRazorpayProvider } from "@/lib/payment-provider-helper";

const REFUND_IDEMPOTENCY_KEY = /^[\x21-\x7E]{1,255}$/;

function resolveOrderRefundIdempotencyKey(
  req: Request,
  bodyKey: string | undefined,
): string {
  const headerKey = extractIdempotencyKey(req);
  const body = bodyKey?.trim() ?? "";
  if (headerKey && body && headerKey !== body) {
    throw new ApiHttpError(
      400,
      "VALIDATION_ERROR",
      "Idempotency-Key header and idempotencyKey body do not match",
      {
        fields: {
          "idempotency-key": "Header and body idempotency keys must be the same",
        },
      },
    );
  }
  const key = headerKey || body;
  if (!key) {
    throw new ApiHttpError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Key is required for refund initiation",
    );
  }
  if (!REFUND_IDEMPOTENCY_KEY.test(key)) {
    throw new ApiHttpError(
      400,
      "VALIDATION_ERROR",
      "Idempotency-Key must be 1 to 255 printable characters",
      {
        fields: {
          "idempotency-key": "Use 1 to 255 printable characters with no spaces",
        },
      },
    );
  }
  return key;
}

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

    const idempotencyKey = resolveOrderRefundIdempotencyKey(req, body.idempotencyKey);

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
