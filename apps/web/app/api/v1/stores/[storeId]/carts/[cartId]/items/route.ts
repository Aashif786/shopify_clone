import { CartService } from "@shopify-clone/carts";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import {
  addCartItemValidator,
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
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

    const items = await cartService.listItems(ctx.db, storeId, cartId);
    return apiSuccess({ items }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, cartId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(cartId, "cartId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, addCartItemValidator);
    const cart = await cartService.addItem(ctx.db, storeId, cartId, {
      variantId: body.variantId,
      quantity: body.quantity,
    });

    return apiSuccess(cart, { status: 201, requestId });
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
    const { storeId, cartId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(cartId, "cartId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const cart = await cartService.clearCart(ctx.db, storeId, cartId);
    return apiSuccess(cart, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
