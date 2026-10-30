import { CartService } from "@calcart/carts";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  cartQueryValidator,
  createCartValidator,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
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

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, createCartValidator);
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;

    const cart = await cartService.createCart(ctx.db, storeId, {
      customerId: body.customerId ?? undefined,
      guestIdentifier: body.guestIdentifier ?? undefined,
      currency: body.currency,
      expiresAt,
    });

    return apiSuccess(cart, { status: 201, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
