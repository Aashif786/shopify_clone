import { CartService } from "@calcart/carts";
import {
  ApiHttpError,
  apiSuccess,
  cartQueryValidator,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateQuery,
  validateUuid,
} from "@/lib/api";

const cartService = new CartService();

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
    const query = validateQuery(req, cartQueryValidator);

    if (query.customerId) {
      const cart = await cartService.getActiveCartForCustomer(
        ctx.db,
        storeId,
        query.customerId,
      );
      if (!cart) {
        throw new ApiHttpError(404, "CART_NOT_FOUND", "Active cart not found for customer");
      }
      return apiSuccess(cart, { requestId });
    }

    if (query.guestIdentifier) {
      const cart = await cartService.getActiveCartForGuest(
        ctx.db,
        storeId,
        query.guestIdentifier,
      );
      if (!cart) {
        throw new ApiHttpError(404, "CART_NOT_FOUND", "Active cart not found for guest");
      }
      return apiSuccess(cart, { requestId });
    }

    throw new ApiHttpError(
      400,
      "VALIDATION_ERROR",
      "Either customerId or guestIdentifier query parameter is required to find an active cart",
      {
        fields: {
          customerId: "Either customerId or guestIdentifier must be provided",
          guestIdentifier: "Either customerId or guestIdentifier must be provided",
        },
      },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
