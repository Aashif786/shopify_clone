import { CheckoutService } from "@shopify-clone/checkout";
import { StoreService } from "@shopify-clone/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateUuid,
  validateBody,
  storefrontUpdateCheckoutValidator,
} from "@/lib/api";
import { enrichCheckout } from "@/lib/storefront-checkout-helpers";
import {
  assertCheckoutOwnership,
  extractGuestToken,
  resolveStorefrontCustomer,
} from "@/lib/storefront-auth-helpers";

const storeService = new StoreService();
const checkoutService = new CheckoutService();

interface RouteContext {
  params: Promise<{ storeSlug: string; checkoutId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, checkoutId } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }
    if (!checkoutId) {
      throw new ApiHttpError(400, "INVALID_CHECKOUT_ID", "Checkout ID is required");
    }
    validateUuid(checkoutId, "checkoutId");

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    const checkout = await checkoutService.getCheckout(ctx.db, store.id, checkoutId);
    if (!checkout || checkout.storeId !== store.id) {
      throw new ApiHttpError(404, "CHECKOUT_NOT_FOUND", "Checkout not found");
    }

    // Server-side authorization check: customer identity or guest ownership token
    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const guestToken = extractGuestToken(req);
    assertCheckoutOwnership(checkout, { customer, guestToken });

    const enriched = await enrichCheckout(ctx.db, store.id, checkout);

    return apiSuccess(
      {
        checkout: enriched,
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          currency: store.currency,
        },
      },
      { requestId },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, checkoutId } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }
    if (!checkoutId) {
      throw new ApiHttpError(400, "INVALID_CHECKOUT_ID", "Checkout ID is required");
    }
    validateUuid(checkoutId, "checkoutId");

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    const checkout = await checkoutService.getCheckout(ctx.db, store.id, checkoutId);
    if (!checkout || checkout.storeId !== store.id) {
      throw new ApiHttpError(404, "CHECKOUT_NOT_FOUND", "Checkout not found");
    }

    // Server-side authorization check: customer identity or guest ownership token
    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const guestToken = extractGuestToken(req);
    assertCheckoutOwnership(checkout, { customer, guestToken });

    // Enforce checkout immutability: completed, cancelled, or expired checkouts cannot be modified
    if (checkout.status !== "OPEN") {
      throw new ApiHttpError(
        400,
        "CHECKOUT_IMMUTABLE",
        `Cannot modify checkout because it is in '${checkout.status}' status`,
      );
    }

    const validated = await validateBody(req, storefrontUpdateCheckoutValidator);

    // Update email if present
    if (validated.email !== undefined) {
      await checkoutService.updateCustomer(ctx.db, store.id, checkoutId, {
        email: validated.email,
        customerId: customer?.id ?? undefined,
      });
    }

    // Update shipping/billing addresses if present
    if (validated.shippingAddress !== undefined) {
      await checkoutService.updateAddresses(ctx.db, store.id, checkoutId, {
        shippingAddress: validated.shippingAddress,
        billingAddress: validated.billingAddress ?? validated.shippingAddress,
      });
    }

    const updated = await checkoutService.getCheckout(ctx.db, store.id, checkoutId);
    const enriched = await enrichCheckout(ctx.db, store.id, updated);

    return apiSuccess(
      {
        checkout: enriched,
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          currency: store.currency,
        },
      },
      { requestId },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
