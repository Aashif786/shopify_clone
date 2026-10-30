import { CheckoutService } from "@calcart/checkout";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  createCheckoutValidator,
  extractIdempotencyKey,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
  validateUuid,
} from "@/lib/api";

const checkoutService = new CheckoutService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
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

    const idempotencyKey = extractIdempotencyKey(req);
    const body = await validateBody(req, createCheckoutValidator);

    const checkout = await checkoutService.createCheckoutFromCart(
      ctx.db,
      storeId,
      body.cartId,
      {
        customerId: body.customerId ?? undefined,
        email: body.email ?? undefined,
        shippingAddress: body.shippingAddress ?? undefined,
        billingAddress: body.billingAddress ?? undefined,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        idempotencyKey: idempotencyKey ?? undefined,
      },
    );

    return apiSuccess(checkout, { status: 201, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
