import { CheckoutService } from "@shopify-clone/checkout";
import { StoreService } from "@shopify-clone/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";
import { enrichCheckout } from "@/lib/storefront-checkout-helpers";
import { DiscountService, type DiscountDTO } from "@shopify-clone/discounts";
import {
  evaluateDiscountCode,
  normalizeDiscountCode,
  resolveStoreDiscount,
  type StoreDiscountDefinition,
} from "@/lib/storefront-discount-helpers";

const storeService = new StoreService();
const checkoutService = new CheckoutService();
const discountService = new DiscountService();

interface RouteContext {
  params: Promise<{ storeSlug: string; checkoutId: string }>;
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

    // 1. Fetch active checkout session
    const checkout = await checkoutService.getCheckout(ctx.db, store.id, checkoutId);
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
    const evaluation = evaluateDiscountCode(discountDef, {
      targetStoreId: store.id,
      subtotal: checkout.subtotal,
      currency: checkout.currency,
    });

    if (!evaluation.isValid || !evaluation.discount) {
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
    });

    const enriched = await enrichCheckout(ctx.db, store.id, updatedCheckout);

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

    const checkout = await checkoutService.getCheckout(ctx.db, store.id, checkoutId);
    if (checkout.status !== "OPEN") {
      throw new ApiHttpError(
        400,
        "CHECKOUT_NOT_EDITABLE",
        `Checkout session is ${checkout.status} and cannot be modified`,
      );
    }

    const updatedCheckout = await checkoutService.updateTotals(ctx.db, store.id, checkoutId, {
      discountTotal: 0,
    });

    const enriched = await enrichCheckout(ctx.db, store.id, updatedCheckout);

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