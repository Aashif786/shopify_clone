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
import { DiscountService, type DiscountDTO } from "@calcart/discounts";
import {
  buildDiscountEvaluationItems,
  evaluateDiscountCode,
  normalizeDiscountCode,
  resolveStoreDiscount,
  type StoreDiscountDefinition,
} from "@/lib/storefront-discount-helpers";
import {
  assertCheckoutOwnership,
  extractGuestToken,
  resolveStorefrontCustomer,
} from "@/lib/storefront-auth-helpers";

const storeService = new StoreService();
const checkoutService = new CheckoutService();
const discountService = new DiscountService();

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

    const body = (await req.json()) as {
      code?: string;
    };

    if (!body || typeof body !== "object") {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Request body is required");
    }

    const normalizedCode = normalizeDiscountCode(body.code);
    if (!normalizedCode) {
      throw new ApiHttpError(
        400,
        "INVALID_DISCOUNT_CODE",
        "Discount code cannot be empty",
      );
    }

    const checkout = await requireOwnedCheckout(req, ctx, store.id, checkoutId);
    if (checkout.status !== "OPEN") {
      throw new ApiHttpError(
        400,
        "CHECKOUT_NOT_EDITABLE",
        `Checkout session is ${checkout.status} and cannot be modified`,
      );
    }

    // 2. Resolve discount for this store (persistent domain with demo fallback)
    let discountDef: DiscountDTO | StoreDiscountDefinition | null =
      await discountService.getDiscountByCode(ctx.db, store.id, normalizedCode);
    if (!discountDef) {
      discountDef = await resolveStoreDiscount(ctx.db, store.id, normalizedCode);
    }

    // 3. Evaluate eligibility and calculate discount against checkout subtotal
    let isFirstTimeCustomer: boolean | undefined = undefined;
    if (checkout.customerId) {
      const orderCountRes = await ctx.db.query<{ count: string }>(
        `SELECT COUNT(*) FROM orders WHERE customer_id = $1 AND store_id = $2 AND status != 'CANCELLED'`,
        [checkout.customerId, store.id]
      );
      isFirstTimeCustomer = Number(orderCountRes.rows[0]?.count ?? 0) === 0;
    }

    const evaluationItems = await buildDiscountEvaluationItems(ctx.db, store.id, checkout.items);

    const evaluation = evaluateDiscountCode(discountDef, {
      targetStoreId: store.id,
      subtotal: checkout.subtotal,
      currency: checkout.currency,
      isFirstTimeCustomer,
      items: evaluationItems,
    });

    if (!evaluation.isValid || !evaluation.discount || !discountDef) {
      throw new ApiHttpError(
        400,
        evaluation.reason ?? "INVALID_DISCOUNT",
        evaluation.errorMessage ?? "Discount code is not valid for this order",
        { details: { reason: evaluation.reason } },
      );
    }

    // 4. Update checkout totals
    const updatedCheckout = await checkoutService.updateTotals(ctx.db, store.id, checkoutId, {
      discountTotal: evaluation.discount.amount,
      discountId: discountDef.id,
      discountCode: normalizedCode,
    });

    const enriched = await enrichStorefrontCheckout(ctx.db, store.id, updatedCheckout);

    return apiSuccess(
      {
        checkout: enriched,
        discount: evaluation.discount,
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

    const checkout = await requireOwnedCheckout(req, ctx, store.id, checkoutId);
    if (checkout.status !== "OPEN") {
      throw new ApiHttpError(
        400,
        "CHECKOUT_NOT_EDITABLE",
        `Checkout session is ${checkout.status} and cannot be modified`,
      );
    }

    const updatedCheckout = await checkoutService.updateTotals(ctx.db, store.id, checkoutId, {
      discountTotal: 0,
      discountId: null,
      discountCode: null,
    });

    const enriched = await enrichStorefrontCheckout(ctx.db, store.id, updatedCheckout);

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