import { CartService } from "@shopify-clone/carts";
import { StoreService } from "@shopify-clone/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateUuid,
  validateBody,
  applyDiscountValidator,
} from "@/lib/api";
import { enrichCart } from "@/lib/storefront-cart-helpers";
import { DiscountService, type DiscountDTO } from "@shopify-clone/discounts";
import {
  evaluateDiscountCode,
  normalizeDiscountCode,
  resolveStoreDiscount,
  type StoreDiscountDefinition,
} from "@/lib/storefront-discount-helpers";
import {
  assertCartOwnership,
  extractGuestIdentifier,
  resolveStorefrontCustomer,
} from "@/lib/storefront-auth-helpers";

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

    const validated = await validateBody(req, applyDiscountValidator);

    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const guestIdentifier = extractGuestIdentifier(req) || validated.guestIdentifier || null;
    const caller = { customerId: customer?.id, guestIdentifier };

    // 1. Fetch active cart with ownership check
    const cart = await cartService.getCart(ctx.db, store.id, validated.cartId, caller);
    assertCartOwnership(cart, caller);

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

    const normalizedCode = normalizeDiscountCode(validated.code);

    // 2. Resolve discount for this specific store
    let discountDef: DiscountDTO | StoreDiscountDefinition | null =
      await discountService.getDiscountByCode(ctx.db, store.id, normalizedCode);
    if (!discountDef) {
      discountDef = await resolveStoreDiscount(ctx.db, store.id, normalizedCode);
    }

    // 3. Evaluate eligibility against server-authoritative cart subtotal
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
    const updatedCart = await cartService.updateTotals(
      ctx.db,
      store.id,
      cart.id,
      {
        discountTotal: evaluation.discount.amount,
      },
      caller,
    );

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

    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const url = new URL(req.url);
    const guestIdentifier =
      extractGuestIdentifier(req) ||
      url.searchParams.get("guestIdentifier") ||
      url.searchParams.get("guest_identifier") ||
      null;
    const caller = { customerId: customer?.id, guestIdentifier };

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

    const cart = await cartService.getCart(ctx.db, store.id, cartId, caller);
    assertCartOwnership(cart, caller);

    // Reset discount total to 0
    const updatedCart = await cartService.updateTotals(
      ctx.db,
      store.id,
      cartId,
      {
        discountTotal: 0,
      },
      caller,
    );

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
