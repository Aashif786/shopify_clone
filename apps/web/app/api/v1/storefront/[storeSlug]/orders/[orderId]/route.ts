import { StoreService } from "@shopify-clone/stores";
import { OrderService } from "@shopify-clone/orders";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const storeService = new StoreService();
const orderService = new OrderService();

interface RouteContext {
  params: Promise<{ storeSlug: string; orderId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, orderId } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }
    if (!orderId) {
      throw new ApiHttpError(400, "INVALID_ORDER_ID", "Order ID is required");
    }
    validateUuid(orderId, "orderId");

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    const order = await orderService.getOrderById(ctx.db, store.id, orderId);
    if (!order || order.storeId !== store.id) {
      throw new ApiHttpError(
        404,
        "ORDER_NOT_FOUND",
        `Order '${orderId}' was not found in this store`,
      );
    }

    return apiSuccess(
      {
        order,
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          currency: store.currency,
        },
      },
      { requestId },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
