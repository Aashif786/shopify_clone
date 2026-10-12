import { CartService } from "@shopify-clone/carts";
import { StoreService } from "@shopify-clone/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";
import { enrichCart } from "@/lib/storefront-cart-helpers";
import { DiscountService, type DiscountDTO } from "@shopify-clone/discounts";
import {
  evaluateDiscountCode,
  normalizeDiscountCode,
  resolveStoreDiscount,
  type StoreDiscountDefinition,
} from "@/lib/storefront-discount-helpers";

const storeService = new StoreService();
const cartService = new CartService();
const discountService = new DiscountService();

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }

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
      cartId?: string;
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

    if (!body.cartId || typeof body.cartId !== "string") {
      throw new ApiHttpError(
        400,
        "MISSING_CART_ID",
        "Cart ID is required to apply discount",
      );
    }
    validateUuid(body.cartId, "cartId");

    // 1. Fetch active cart
    const cart = await cartService.getCart(ctx.db, store.id, body.cartId);
    if (cart.status !== "ACTIVE") {
      throw new ApiHttpError(
        400,
        "CART_NOT_ACTIVE",
        `Cart is ${cart.status} and cannot be modified`,
      );
    }

    if (cart.items.length === 0) {
      throw new ApiHttpError(
        400,
        "EMPTY_CART",
        "Cannot apply discount to an empty cart",
      );
    }

    // 2. Resolve discount for this specific store (persistent domain with demo fallback)
    let discountDef: DiscountDTO | StoreDiscountDefinition | null =
      await discountService.getDiscountByCode(ctx.db, store.id, normalizedCode);
    if (!discountDef) {
      discountDef = await resolveStoreDiscount(ctx.db, store.id, normalizedCode);
    }

    // 3. Evaluate eligibility and calculate discount against server-authoritative cart subtotal
    const evaluation = evaluateDiscountCode(discountDef, {
      targetStoreId: store.id,
      subtotal: cart.subtotal,
      currency: cart.currency,
    });

    if (!evaluation.isValid || !evaluation.discount) {
      throw new ApiHttpError(
        400,
        evaluation.reason ?? "INVALID_DISCOUNT",
        evaluation.errorMessage ?? "Discount code is not valid for this order",
        { details: { reason: evaluation.reason } },
      );
    }

    // 4. Atomically persist authoritative discount total on the cart
    const updatedCart = await cartService.updateTotals(ctx.db, store.id, cart.id, {
      discountTotal: evaluation.discount.amount,
    });

    const enriched = await enrichCart(ctx.db, store.id, updatedCart);

    return apiSuccess(
      {
        cart: enriched,
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

    const { storeSlug } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    const url = new URL(req.url);
    const cartId =
      url.searchParams.get("cartId") ||
      req.headers.get("x-cart-id") ||
      undefined;

    if (!cartId) {
      throw new ApiHttpError(
        400,
        "MISSING_CART_ID",
        "Cart ID is required to remove discount",
      );
    }
    validateUuid(cartId, "cartId");

    // Reset discount total to 0
    const updatedCart = await cartService.updateTotals(ctx.db, store.id, cartId, {
      discountTotal: 0,
    });

    const enriched = await enrichCart(ctx.db, store.id, updatedCart);

    return apiSuccess(
      {
        cart: enriched,
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
