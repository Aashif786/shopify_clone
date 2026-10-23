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
  params: Promise<{ storeId: string; paymentId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId, paymentId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(paymentId, "paymentId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, createRefundValidator);

    const headerIdempotencyKey =
      req.headers.get("idempotency-key") ||
      req.headers.get("x-idempotency-key") ||
      undefined;
    const idempotencyKey =
      body.idempotencyKey ||
      (headerIdempotencyKey ? headerIdempotencyKey.trim() : undefined);

    if (!idempotencyKey) {
      throw new ApiHttpError(
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "Idempotency-Key header is required for refund initiation",
      );
    }

    // Look up payment to get orderId
    const payment = await ctx.db.query<{
      id: string;
      order_id: string | null;
      store_id: string;
      status: string;
      captured_amount: string | number;
      refunded_amount: string | number;
      currency: string;
    }>(
      `SELECT id, order_id, store_id, status, captured_amount, refunded_amount, currency
       FROM payments
       WHERE id = $1 AND store_id = $2`,
      [paymentId, storeId],
    );

    if (payment.rows.length === 0) {
      const anyStore = await ctx.db.query<{ store_id: string }>(
        `SELECT store_id FROM payments WHERE id = $1`,
        [paymentId],
      );
      if (anyStore.rows.length > 0 && anyStore.rows[0]?.store_id !== storeId) {
        throw new ApiHttpError(
          403,
          "CROSS_STORE_PAYMENT_ACCESS",
          `Payment '${paymentId}' does not belong to store '${storeId}'`,
        );
      }
      throw new ApiHttpError(
        404,
        "PAYMENT_NOT_FOUND",
        `Payment '${paymentId}' not found in store '${storeId}'`,
      );
    }

    const paymentRow = payment.rows[0]!;
    if (!paymentRow.order_id) {
      throw new ApiHttpError(
        400,
        "PAYMENT_NOT_REFUNDABLE",
        `Payment '${paymentId}' is not associated with an order and cannot be refunded`,
      );
    }

    const provider = tryGetRazorpayProvider();

    const result = await refundService.executeMerchantRefund(ctx.db, {
      storeId,
      orderId: paymentRow.order_id,
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

    return apiSuccess(
      {
        id: result.refund.id,
        paymentId: result.refund.paymentId,
        amount: result.refund.amount,
        currency: result.refund.currency,
        status: result.status,
        providerRefundId: result.providerRefundId ?? null,
        remainingRefundable: result.remainingRefundable,
      },
      { requestId, status: 201 },
    );
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
    const { storeId, paymentId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(paymentId, "paymentId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    // Enforce tenant boundary: verify payment exists and belongs to this store
    const payment = await ctx.db.query<{ id: string; store_id: string }>(
      `SELECT id, store_id FROM payments WHERE id = $1`,
      [paymentId],
    );
    if (payment.rows.length === 0) {
      throw new ApiHttpError(404, "PAYMENT_NOT_FOUND", `Payment '${paymentId}' not found in store '${storeId}'`);
    }
    if (payment.rows[0]?.store_id !== storeId) {
      throw new ApiHttpError(403, "CROSS_STORE_PAYMENT_ACCESS", `Payment '${paymentId}' does not belong to store '${storeId}'`);
    }

    const refunds = await refundService.getRefundsByPaymentId(ctx.db, storeId, paymentId);
    return apiSuccess(refunds, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
