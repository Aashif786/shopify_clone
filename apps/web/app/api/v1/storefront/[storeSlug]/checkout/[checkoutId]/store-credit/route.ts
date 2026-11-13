import { CheckoutNotFoundError, CheckoutService, type CheckoutDTO } from "@calcart/checkout";
import { StoreService } from "@calcart/stores";
import { GiftCardService } from "@calcart/giftcards";
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
const giftCardService = new GiftCardService();

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
): Promise<{ checkout: CheckoutDTO; customer: { id: string; email: string } | null }> {
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
  return { checkout, customer };
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

    const { checkout, customer } = await requireOwnedCheckout(req, ctx, store.id, checkoutId);

    let availableBalance = 0;
    if (customer) {
      const creditAccount = await giftCardService.getOrCreateStoreCredit(
        ctx.db,
        store.id,
        customer.id,
        checkout.currency,
      );
      availableBalance = creditAccount.currentBalance;
    }

    const appliedAmount = checkout.appliedStoreCredit?.appliedAmount ?? 0;

    return apiSuccess(
      {
        isLoggedIn: !!customer,
        availableBalance,
        currency: checkout.currency,
        appliedAmount,
        appliedStoreCredit: checkout.appliedStoreCredit,
      },
      { requestId, timing: ctx.timing, status: 200 },
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

    const { checkout, customer } = await requireOwnedCheckout(req, ctx, store.id, checkoutId);
    if (checkout.status !== "OPEN") {
      throw new ApiHttpError(
        400,
        "CHECKOUT_NOT_EDITABLE",
        `Checkout session is ${checkout.status} and cannot be modified`,
      );
    }

    if (!customer) {
      throw new ApiHttpError(
        401,
        "CUSTOMER_AUTH_REQUIRED",
        "Please sign in to apply store credits to your checkout",
      );
    }

    let requestedAmount: number | undefined;
    try {
      const body = (await req.json()) as { amount?: number };
      if (body && typeof body.amount === "number" && Number.isFinite(body.amount)) {
        requestedAmount = Math.max(0, Math.floor(body.amount));
      }
    } catch {
      // Body is optional; defaults to max eligible balance
    }

    const updatedCheckout = await checkoutService.applyStoreCredit(
      ctx.db,
      store.id,
      checkoutId,
      customer.id,
      requestedAmount,
    );
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

    const { checkout } = await requireOwnedCheckout(req, ctx, store.id, checkoutId);
    if (checkout.status !== "OPEN") {
      throw new ApiHttpError(
        400,
        "CHECKOUT_NOT_EDITABLE",
        `Checkout session is ${checkout.status} and cannot be modified`,
      );
    }

    const updatedCheckout = await checkoutService.removeStoreCredit(ctx.db, store.id, checkoutId);
    const enriched = await enrichStorefrontCheckout(ctx.db, store.id, updatedCheckout);

    return apiSuccess({ checkout: enriched }, { requestId, timing: ctx.timing, status: 200 });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
