import { OrderCancellationCoordinator } from "@shopify-clone/orders";
import { ReservationReleaseService } from "@shopify-clone/inventory";
import { OrderCancellationRefundService } from "@shopify-clone/payments";
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

const reservationReleaseService = new ReservationReleaseService();
const cancellationRefundService = new OrderCancellationRefundService();
const orderCancellationCoordinator = new OrderCancellationCoordinator(
  undefined,
  undefined,
  reservationReleaseService,
  cancellationRefundService,
);

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

    const result = await orderCancellationCoordinator.cancelOrder(ctx.db, {
      storeId,
      orderId,
      reason: body.reason,
      actorType: "MERCHANT",
      actorId: auth.user.id,
    });

    return apiSuccess(result.order, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
