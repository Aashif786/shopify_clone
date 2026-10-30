import { CheckoutService } from "@calcart/checkout";
import { ReservationReleaseService } from "@calcart/inventory";
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

const checkoutService = new CheckoutService();
const reservationReleaseService = new ReservationReleaseService();

interface RouteContext {
  params: Promise<{ storeId: string; checkoutId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, checkoutId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(checkoutId, "checkoutId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const checkout = await checkoutService.cancelCheckout(ctx.db, storeId, checkoutId);

    // Release any reserved inventory held by this checkout immediately
    await reservationReleaseService.releaseOrderReservations(ctx.db, {
      storeId,
      checkoutId,
    });

    return apiSuccess(checkout, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
