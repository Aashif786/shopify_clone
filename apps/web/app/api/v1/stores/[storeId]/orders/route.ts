import { OrderService } from "@calcart/orders";
import {
  apiSuccess,
  handleApiError,
  listOrdersQueryValidator,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateQuery,
  validateUuid,
} from "@/lib/api";

const orderService = new OrderService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    await requireStoreOrNotFound(ctx, storeId, "staff");
    const query = validateQuery(req, listOrdersQueryValidator);

    const result = await orderService.listOrders(ctx.db, storeId, query);
    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
