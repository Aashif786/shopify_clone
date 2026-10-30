import { CartService } from "@calcart/carts";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
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

async function handleClear(req: Request, context: RouteContext) {
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

export async function POST(req: Request, context: RouteContext) {
  return handleClear(req, context);
}

export async function DELETE(req: Request, context: RouteContext) {
  return handleClear(req, context);
}
