import { CartService } from "@shopify-clone/carts";
import { StoreService } from "@shopify-clone/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
} from "@/lib/api";
import { enrichCart } from "@/lib/storefront-cart-helpers";

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

    const url = new URL(req.url);
    const cartId =
      url.searchParams.get("cartId") ||
      req.headers.get("x-cart-id") ||
      undefined;
    const guestIdentifier =
      url.searchParams.get("guestIdentifier") ||
      req.headers.get("x-guest-identifier") ||
      undefined;

    let cart = null;

    if (cartId) {
      try {
        const found = await cartService.getCart(ctx.db, store.id, cartId);
        if (found.status === "ACTIVE") {
          cart = found;
        }
      } catch {
        // If cart not found or inactive, cart remains null
      }
    }

    if (!cart && guestIdentifier) {
      cart = await cartService.getActiveCartForGuest(
        ctx.db,
        store.id,
        guestIdentifier,
      );
    }

    if (!cart && ctx.auth?.user?.id) {
      cart = await cartService.getActiveCartForCustomer(
        ctx.db,
        store.id,
        ctx.auth.user.id,
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

    const url = new URL(req.url);
    const cartId =
      url.searchParams.get("cartId") ||
      req.headers.get("x-cart-id") ||
      undefined;

    if (!cartId) {
      throw new ApiHttpError(400, "MISSING_CART_ID", "Cart ID is required to clear cart");
    }

    const cleared = await cartService.clearCart(ctx.db, store.id, cartId);
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
