import { OrderService } from "@calcart/orders";
import { apiSuccess, handleApiError, validateUuid } from "@/lib/api";
import { requireApiKey } from "@/lib/api/public-auth";
import { getDb } from "@/lib/db";

const orderService = new OrderService();

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const { storeId } = await requireApiKey(req, "read:orders");
    const { orderId } = await Promise.resolve(context.params);
    validateUuid(orderId, "orderId");

    const db = getDb();
    const order = await orderService.getOrderById(db, storeId, orderId);

    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error);
  }
}
