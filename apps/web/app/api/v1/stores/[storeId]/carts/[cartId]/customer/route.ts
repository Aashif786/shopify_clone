import { CartService } from "@shopify-clone/carts";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import {
  ApiHttpError,
  apiSuccess,
  associateCustomerValidator,
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

    const body = await validateBody(req, associateCustomerValidator);
    const cart = await cartService.associateCustomer(
      ctx.db,
      storeId,
      cartId,
      body.customerId,
    );

    return apiSuccess(cart, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
