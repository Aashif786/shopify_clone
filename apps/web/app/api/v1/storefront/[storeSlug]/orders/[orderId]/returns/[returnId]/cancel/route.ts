import { StoreService } from "@calcart/stores";
import { OrderService } from "@calcart/orders";
import { ReturnService } from "@calcart/returns";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";
import {
  assertOrderOwnership,
  extractGuestToken,
  resolveStorefrontCustomer,
} from "@/lib/storefront-auth-helpers";

const storeService = new StoreService();
const orderService = new OrderService();
const returnService = new ReturnService();

interface RouteContext {
  params: Promise<{ storeSlug: string; orderId: string; returnId: string }>;
}

/** Customer withdraws their own return request before a merchant decision. */
export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, orderId, returnId } = await Promise.resolve(
      context.params,
    );
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }
    validateUuid(orderId, "orderId");
    validateUuid(returnId, "returnId");

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
      throw new ApiHttpError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const guestToken = extractGuestToken(req);
    assertOrderOwnership(order, { customer, guestToken });

    const existing = await returnService.getReturnRequest(
      ctx.db,
      store.id,
      returnId,
    );
    // Owning the order is not sufficient: the return must belong to *this*
    // order, otherwise a customer could cancel a return on another order
    // within the same store.
    if (!existing || existing.orderId !== order.id) {
      throw new ApiHttpError(
        404,
        "RETURN_REQUEST_NOT_FOUND",
        "Return request not found",
      );
    }

    const cancelled = await returnService.cancelReturnRequest(ctx.db, {
      storeId: store.id,
      returnRequestId: returnId,
      actorId: customer?.id ?? null,
      reason: "Withdrawn by customer",
    });

    return apiSuccess(cancelled, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
