import { OrderStatusService } from "@shopify-clone/orders";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import {
  ApiHttpError,
  apiSuccess,
  cancelOrderValidator,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
  validateUuid,
} from "@/lib/api";

const orderStatusService = new OrderStatusService();

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

    const body = await validateBody(req, cancelOrderValidator);

    const cancelledOrder = await orderStatusService.cancelOrder(ctx.db, {
      storeId,
      orderId,
      reason: body.reason,
      actorType: "MERCHANT",
      actorId: auth.user.id,
    });

    return apiSuccess(cancelledOrder, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
