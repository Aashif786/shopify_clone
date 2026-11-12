import { CheckoutNotFoundError, CheckoutService, type CheckoutDTO } from "@calcart/checkout";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateUuid,
  type RequestContext,
} from "@/lib/api";
import { enrichStorefrontCheckout } from "@/lib/storefront-checkout-server";
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

function checkoutNotFound(): ApiHttpError {
  return new ApiHttpError(
    404,
    "CHECKOUT_NOT_FOUND",
    "Checkout was not found in this store",
  );
}

async function requireOwnedCheckout(
  req: Request,
  ctx: RequestContext,
  storeId: string,
  checkoutId: string,
): Promise<CheckoutDTO> {
  let checkout: CheckoutDTO;
  try {
    checkout = await checkoutService.getCheckout(ctx.db, storeId, checkoutId);
  } catch (error) {
    if (error instanceof CheckoutNotFoundError) {
      throw checkoutNotFound();
    }
    throw error;
  }

  if (checkout.storeId !== storeId) {
    throw checkoutNotFound();
  }

  const customer = await resolveStorefrontCustomer(ctx, storeId);
  const guestToken = extractGuestToken(req);
  assertCheckoutOwnership(checkout, { customer, guestToken });
  return checkout;
}

export async function POST(req: Request, context: RouteContext) {
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

    const body = (await req.json()) as { code?: string };
    if (!body || typeof body !== "object" || !body.code || typeof body.code !== "string") {
      throw new ApiHttpError(400, "INVALID_GIFT_CARD_CODE", "Gift card code is required");
    }

    const code = body.code.trim();
    if (!code) {
      throw new ApiHttpError(400, "INVALID_GIFT_CARD_CODE", "Gift card code cannot be empty");
    }

    const checkout = await requireOwnedCheckout(req, ctx, store.id, checkoutId);
    if (checkout.status !== "OPEN") {
      throw new ApiHttpError(
        400,
        "CHECKOUT_NOT_EDITABLE",
        `Checkout session is ${checkout.status} and cannot be modified`,
      );
    }

    const updatedCheckout = await checkoutService.applyGiftCard(ctx.db, store.id, checkoutId, code);
    const enriched = await enrichStorefrontCheckout(ctx.db, store.id, updatedCheckout);

    return apiSuccess({ checkout: enriched }, { requestId, timing: ctx.timing, status: 200 });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
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

    const url = new URL(req.url);
    let giftCardId = url.searchParams.get("giftCardId");

    if (!giftCardId) {
      try {
        const body = (await req.json()) as { giftCardId?: string };
        if (body && typeof body.giftCardId === "string") {
          giftCardId = body.giftCardId;
        }
      } catch {
        // Body was optional if query param was present
      }
    }

    if (!giftCardId) {
      throw new ApiHttpError(400, "INVALID_GIFT_CARD_ID", "Gift card ID is required");
    }
    validateUuid(giftCardId, "giftCardId");

    const checkout = await requireOwnedCheckout(req, ctx, store.id, checkoutId);
    if (checkout.status !== "OPEN") {
      throw new ApiHttpError(
        400,
        "CHECKOUT_NOT_EDITABLE",
        `Checkout session is ${checkout.status} and cannot be modified`,
      );
    }

    const updatedCheckout = await checkoutService.removeGiftCard(ctx.db, store.id, checkoutId, giftCardId);
    const enriched = await enrichStorefrontCheckout(ctx.db, store.id, updatedCheckout);

    return apiSuccess({ checkout: enriched }, { requestId, timing: ctx.timing, status: 200 });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
