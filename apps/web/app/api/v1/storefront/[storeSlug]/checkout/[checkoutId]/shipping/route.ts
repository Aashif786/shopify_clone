import { CheckoutService } from "@calcart/checkout";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  selectShippingRateValidator,
  validateBody,
  validateUuid,
} from "@/lib/api";
import {
  assertCheckoutOwnership,
  extractGuestToken,
  resolveStorefrontCustomer,
} from "@/lib/storefront-auth-helpers";
import { enrichStorefrontCheckout } from "@/lib/storefront-checkout-server";

const storeService = new StoreService();
const checkoutService = new CheckoutService();

interface RouteContext {
  params: Promise<{ storeSlug: string; checkoutId: string }>;
}

/**
 * The customer picks one of the shipping options offered for their address.
 *
 * Ownership is the same server-side check as the checkout itself. The id is
 * only ever a *choice among options the server computed*: the price comes from
 * the stored rate, never from the request, and an id that is not currently on
 * offer is rejected with `SHIPPING_RATE_NOT_AVAILABLE`.
 */
export async function PUT(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, checkoutId } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }
    validateUuid(checkoutId, "checkoutId");

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(404, "STOREFRONT_NOT_FOUND", "Store is not publicly available");
    }

    const checkout = await checkoutService.getCheckout(ctx.db, store.id, checkoutId);
    if (!checkout || checkout.storeId !== store.id) {
      throw new ApiHttpError(404, "CHECKOUT_NOT_FOUND", "Checkout not found");
    }

    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const guestToken = extractGuestToken(req);
    assertCheckoutOwnership(checkout, { customer, guestToken });

    const body = await validateBody(req, selectShippingRateValidator);
    const updated = await checkoutService.selectShippingRate(
      ctx.db,
      store.id,
      checkoutId,
      body.rateId,
    );

    const enriched = await enrichStorefrontCheckout(ctx.db, store.id, updated);
    return apiSuccess(
      { checkout: { ...enriched, guestToken: guestToken ?? undefined } },
      { requestId },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
