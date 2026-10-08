import { CartService } from "@shopify-clone/carts";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  updateCartItemQuantityValidator,
  validateBody,
  validateUuid,
} from "@/lib/api";

const cartService = new CartService();

interface RouteContext {
  params: Promise<{ storeId: string; cartId: string; itemId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, cartId, itemId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(cartId, "cartId");
    validateUuid(itemId, "itemId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const item = await cartService.getItem(ctx.db, storeId, cartId, itemId);
    return apiSuccess(item, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, cartId, itemId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(cartId, "cartId");
    validateUuid(itemId, "itemId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, updateCartItemQuantityValidator);
    const cart = await cartService.updateItemQuantity(
      ctx.db,
      storeId,
      cartId,
      itemId,
      body.quantity,
    );

    return apiSuccess(cart, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, cartId, itemId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(cartId, "cartId");
    validateUuid(itemId, "itemId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const cart = await cartService.removeItem(ctx.db, storeId, cartId, itemId);
    return apiSuccess(cart, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
