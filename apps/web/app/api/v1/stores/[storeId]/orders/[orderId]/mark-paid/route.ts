import { PaymentOrderIntegration } from "@calcart/payments";
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

const paymentOrderIntegration = new PaymentOrderIntegration();

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
    if (!hasRoleAtLeast(member.role, "staff")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least staff role in this store",
      );
    }

    let reason: string | undefined;
    try {
      const body = (await req.json()) as { reason?: string };
      if (body && typeof body.reason === "string") {
        reason = body.reason;
      }
    } catch {
      // Empty or non-JSON body is acceptable
    }

    const result = await paymentOrderIntegration.markCodPaymentCollected(ctx.db, {
      storeId,
      orderId,
      actorId: auth.user.id,
      reason,
    });

    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
