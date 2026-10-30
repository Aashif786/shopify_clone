import { OrderService } from "@calcart/orders";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const orderService = new OrderService();

interface RouteContext {
  params: Promise<{ storeId: string; orderId: string }>;
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

    const order = await orderService.getOrderById(ctx.db, storeId, orderId);
    if (!order) {
      throw new ApiHttpError(404, "ORDER_NOT_FOUND", `Order '${orderId}' not found`);
    }

    return apiSuccess(order, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
