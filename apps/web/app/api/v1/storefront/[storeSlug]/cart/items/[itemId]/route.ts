import { CartService } from "@calcart/carts";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateUuid,
  validateBody,
  storefrontUpdateCartItemQuantityValidator,
  parseJsonBody,
} from "@/lib/api";
import { enrichCart } from "@/lib/storefront-cart-helpers";
import {
  assertCartOwnership,
  extractGuestIdentifier,
  resolveStorefrontCustomer,
} from "@/lib/storefront-auth-helpers";

const storeService = new StoreService();
const cartService = new CartService();

interface RouteContext {
  params: Promise<{ storeSlug: string; itemId: string }>;
}

export async function PATCH(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, itemId } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }
    if (!itemId) {
      throw new ApiHttpError(400, "INVALID_ITEM_ID", "Item ID is required");
    }
    validateUuid(itemId, "itemId");

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    const validated = await validateBody(req, storefrontUpdateCartItemQuantityValidator);

    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const guestIdentifier = extractGuestIdentifier(req) || validated.guestIdentifier || null;
    const caller = { customerId: customer?.id, guestIdentifier };

    const cart = await cartService.getCart(ctx.db, store.id, validated.cartId, caller);
    assertCartOwnership(cart, caller);

    const updated = await cartService.updateItemQuantity(
      ctx.db,
      store.id,
      validated.cartId,
      itemId,
      validated.quantity,
      caller,
    );

    const enriched = await enrichCart(ctx.db, store.id, updated);

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

export async function DELETE(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, itemId } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }
    if (!itemId) {
      throw new ApiHttpError(400, "INVALID_ITEM_ID", "Item ID is required");
    }
    validateUuid(itemId, "itemId");

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
    let guestIdentifier =
      extractGuestIdentifier(req) ||
      url.searchParams.get("guestIdentifier") ||
      url.searchParams.get("guest_identifier") ||
      null;

    let cartId = url.searchParams.get("cartId") || req.headers.get("x-cart-id");
    if (!cartId || !guestIdentifier) {
      try {
        const body = await parseJsonBody<{ cartId?: string; guestIdentifier?: string }>(req);
        if (body && typeof body === "object") {
          if (!cartId && typeof body.cartId === "string") {
            cartId = body.cartId;
          }
          if (!guestIdentifier && typeof body.guestIdentifier === "string") {
            guestIdentifier = body.guestIdentifier;
          }
        }
      } catch {
        // no json body
      }
    }
    const caller = { customerId: customer?.id, guestIdentifier };

    if (!cartId) {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "cartId is required");
    }
    validateUuid(cartId, "cartId");

    const cart = await cartService.getCart(ctx.db, store.id, cartId, caller);
    assertCartOwnership(cart, caller);

    const updated = await cartService.removeItem(
      ctx.db,
      store.id,
      cartId,
      itemId,
      caller,
    );

    const enriched = await enrichCart(ctx.db, store.id, updated);

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
