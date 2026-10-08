import { CartService } from "@shopify-clone/carts";
import {
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const cartService = new CartService();

interface RouteContext {
  params: Promise<{ storeId: string; cartId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, cartId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(cartId, "cartId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const cart = await cartService.getCart(ctx.db, storeId, cartId);
    return apiSuccess(cart, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
