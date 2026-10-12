import { CheckoutService, type CheckoutAddressDTO } from "@shopify-clone/checkout";
import { StoreService } from "@shopify-clone/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";
import {
  enrichCheckout,
  isValidEmail,
  validateShippingAddress,
} from "@/lib/storefront-checkout-helpers";

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

    const body = (await req.json()) as {
      email?: string;
      shippingAddress?: CheckoutAddressDTO;
      billingAddress?: CheckoutAddressDTO;
    };

    if (!body || typeof body !== "object") {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Request body is required");
    }

    // Validate email if present
    if (body.email !== undefined) {
      if (!isValidEmail(body.email)) {
        throw new ApiHttpError(
          400,
          "INVALID_EMAIL",
          "A valid email address is required",
          { fields: { email: "Please enter a valid email address" } },
        );
      }
      await checkoutService.updateCustomer(ctx.db, store.id, checkoutId, {
        email: body.email.trim(),
        customerId: ctx.auth?.user?.id ?? undefined,
      });
    }

    // Validate and update shipping/billing addresses if present
    if (body.shippingAddress !== undefined) {
      const addressValidation = validateShippingAddress(body.shippingAddress);
      if (!addressValidation.isValid) {
        throw new ApiHttpError(
          400,
          "INVALID_SHIPPING_ADDRESS",
          "Shipping address contains invalid or missing required fields",
          { fields: addressValidation.errors },
        );
      }

      await checkoutService.updateAddresses(ctx.db, store.id, checkoutId, {
        shippingAddress: body.shippingAddress,
        billingAddress: body.billingAddress ?? body.shippingAddress,
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
