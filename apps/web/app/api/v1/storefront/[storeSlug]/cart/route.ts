import { CartService } from "@calcart/carts";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateUuid,
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

    if (cart && cart.currency !== store.currency && cart.items.length === 0) {
      await cartService.updateCartCurrency(ctx.db, store.id, cart.id, store.currency);
      cart = await cartService.getCart(ctx.db, store.id, cart.id, caller);
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
    const url = new URL(req.url);
    let guestIdentifier =
      extractGuestIdentifier(req) ||
      url.searchParams.get("guestIdentifier") ||
      url.searchParams.get("guest_identifier") ||
      null;
    const caller = { customerId: customer?.id, guestIdentifier };

    let cartId =
      url.searchParams.get("cartId") ||
      req.headers.get("x-cart-id") ||
      undefined;

    if (!cartId || !guestIdentifier) {
      try {
        const body = await parseJsonBody<{ cartId?: string; guestIdentifier?: string }>(req);
        if (body && typeof body === "object") {
          if (!cartId && typeof body.cartId === "string") {
            cartId = body.cartId;
          }
          if (!guestIdentifier && typeof body.guestIdentifier === "string") {
            guestIdentifier = body.guestIdentifier;
            caller.guestIdentifier = guestIdentifier;
          }
        }
      } catch {
        // no json body
      }
    }

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
