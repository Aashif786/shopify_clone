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
import {
  assertCartOwnership,
  extractGuestIdentifier,
  resolveStorefrontCustomer,
} from "@/lib/storefront-auth-helpers";

const storeService = new StoreService();
const cartService = new CartService();

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

export async function GET(req: Request, context: RouteContext) {
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
    const guestIdentifier = extractGuestIdentifier(req);
    const caller = { customerId: customer?.id, guestIdentifier };

    const url = new URL(req.url);
    const cartId =
      url.searchParams.get("cartId") ||
      req.headers.get("x-cart-id") ||
      undefined;

    let cart = null;

    if (cartId) {
      validateUuid(cartId, "cartId");
      try {
        const found = await cartService.getCart(ctx.db, store.id, cartId, caller);
        if (found.status === "ACTIVE") {
          assertCartOwnership(found, caller);
          cart = found;
        }
      } catch (err) {
        if (err instanceof ApiHttpError) {
          throw err;
        }
        // Cart not found or inactive, remain null
      }
    }

    if (!cart && customer) {
      cart = await cartService.getActiveCartForCustomer(
        ctx.db,
        store.id,
        customer.id,
      );
    }

    if (!cart && guestIdentifier) {
      cart = await cartService.getActiveCartForGuest(
        ctx.db,
        store.id,
        guestIdentifier,
      );
    }

    const enriched = cart ? await enrichCart(ctx.db, store.id, cart) : null;

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

    const { storeSlug } = await Promise.resolve(context.params);
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const guestIdentifier = extractGuestIdentifier(req);
    const caller = { customerId: customer?.id, guestIdentifier };

    const url = new URL(req.url);
    const cartId =
      url.searchParams.get("cartId") ||
      req.headers.get("x-cart-id") ||
      undefined;

    if (!cartId) {
      throw new ApiHttpError(400, "MISSING_CART_ID", "Cart ID is required to clear cart");
    }
    validateUuid(cartId, "cartId");

    const cart = await cartService.getCart(ctx.db, store.id, cartId, caller);
    assertCartOwnership(cart, caller);

    const cleared = await cartService.clearCart(ctx.db, store.id, cartId, caller);
    const enriched = await enrichCart(ctx.db, store.id, cleared);

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
