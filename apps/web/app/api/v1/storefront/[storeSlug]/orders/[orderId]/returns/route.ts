import { StoreService } from "@calcart/stores";
import { OrderService } from "@calcart/orders";
import { ReturnService } from "@calcart/returns";
import {
  ApiHttpError,
  apiSuccess,
  createReturnRequestValidator,
  handleApiError,
  resolveRequestContext,
  validateBody,
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
  params: Promise<{ storeSlug: string; orderId: string }>;
}

/**
 * Resolves the store and order, then asserts the caller owns the order.
 * Ownership is established server-side from the session customer or the guest
 * ownership token; a client-supplied customer id is never trusted.
 */
async function resolveOwnedOrder(req: Request, context: RouteContext) {
  const ctx = await resolveRequestContext(req);
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
    throw new ApiHttpError(404, "ORDER_NOT_FOUND", "Order not found");
  }

  const customer = await resolveStorefrontCustomer(ctx, store.id);
  const guestToken = extractGuestToken(req);
  assertOrderOwnership(order, { customer, guestToken });

  return { ctx, store, order, customer };
}

/** Return eligibility for this order, including per-line returnable quantity. */
export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const { ctx, store, order, customer } = await resolveOwnedOrder(
      req,
      context,
    );
    requestId = ctx.requestId;

    const eligibility = await returnService.getOrderReturnEligibility(
      ctx.db,
      store.id,
      order,
    );

    const existing = await returnService.listReturnRequests(ctx.db, {
      storeId: store.id,
      orderId: order.id,
      limit: 20,
    });

    return apiSuccess(
      {
        eligibility,
        returns: existing.returns,
        customerId: customer?.id ?? null,
      },
      { requestId },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

/** Opens a return request on behalf of the authenticated or guest owner. */
export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const { ctx, store, order, customer } = await resolveOwnedOrder(
      req,
      context,
    );
    requestId = ctx.requestId;

    const body = await validateBody(req, createReturnRequestValidator);

    const returnRequest = await returnService.createReturnRequest(ctx.db, {
      storeId: store.id,
      orderId: order.id,
      // Server-resolved identity only.
      customerId: customer?.id ?? order.customerId ?? null,
      reason: body.reason,
      customerNote: body.customerNote ?? null,
      items: body.items,
      actorType: "CUSTOMER",
      actorId: customer?.id ?? null,
    });

    return apiSuccess(returnRequest, { requestId, status: 201 });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
