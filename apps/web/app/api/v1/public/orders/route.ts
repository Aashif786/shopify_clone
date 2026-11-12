import { OrderService } from "@calcart/orders";
import {
  apiSuccess,
  handleApiError,
  listOrdersQueryValidator,
  validateQuery,
} from "@/lib/api";
import { requireApiKey } from "@/lib/api/public-auth";
import { getDb } from "@/lib/db";

const orderService = new OrderService();

export async function GET(req: Request) {
  try {
    const { storeId } = await requireApiKey(req, "read:orders");
    const db = getDb();
    const query = validateQuery(req, listOrdersQueryValidator);

    const result = await orderService.listOrders(db, storeId, query);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
