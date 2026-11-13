import { OrderLifecycleCoordinator } from "@calcart/orders";
import { ReservationReleaseService } from "@calcart/inventory";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  updateOrderStatusValidator,
  validateBody,
  validateUuid,
} from "@/lib/api";

const orderLifecycleCoordinator = new OrderLifecycleCoordinator(
  undefined,
  new ReservationReleaseService(),
);

interface RouteContext {
  params: Promise<{ storeId: string; orderId: string }>;
}

/**
 * Moves an order along its lifecycle: confirm, process, ship, deliver, complete.
 *
 * The caller's store role and the store scope come from the session, never the
 * body. The order state machine decides whether the move is legal from the
 * order's current status, so a skipped or backwards step is a 400. Cancellation
 * is intentionally not accepted here; it has its own endpoint because it
 * releases stock and may refund a payment.
 */
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

    const body = await validateBody(req, updateOrderStatusValidator);

    const order = await orderLifecycleCoordinator.transition(ctx.db, {
      storeId,
      orderId,
      toStatus: body.toStatus,
      actorType: "MERCHANT",
      actorId: auth.user.id,
      reason: body.reason,
    });

    return apiSuccess(order, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
