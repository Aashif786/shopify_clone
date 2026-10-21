import { CartService } from "@shopify-clone/carts";
import { generateUuidV7 } from "@shopify-clone/db";
import { StoreService } from "@shopify-clone/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateBody,
  storefrontAddCartItemValidator,
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

    const validated = await validateBody(req, storefrontAddCartItemValidator);

    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const guestIdentifier = extractGuestIdentifier(req) || validated.guestIdentifier;
    const caller = { customerId: customer?.id, guestIdentifier };

    // Resolve or create cart with strict ownership enforcement
    let activeCartId: string;

    if (validated.cartId) {
      const existing = await cartService.getCart(ctx.db, store.id, validated.cartId, caller);
      assertCartOwnership(existing, caller);
      activeCartId = existing.id;
    } else if (customer) {
      let customerCart = await cartService.getActiveCartForCustomer(
        ctx.db,
        store.id,
        customer.id,
      );
      if (!customerCart) {
        customerCart = await cartService.getOrCreateCart(ctx.db, store.id, {
          customerId: customer.id,
          currency: store.currency,
        });
      }
      activeCartId = customerCart.id;
    } else {
      const effectiveGuestId = guestIdentifier || generateUuidV7();
      let guestCart = await cartService.getActiveCartForGuest(
        ctx.db,
        store.id,
        effectiveGuestId,
      );
      if (!guestCart) {
        guestCart = await cartService.getOrCreateCart(ctx.db, store.id, {
          guestIdentifier: effectiveGuestId,
          currency: store.currency,
        });
      }
      activeCartId = guestCart.id;
    }

    const updated = await cartService.addItem(
      ctx.db,
      store.id,
      activeCartId,
      {
        variantId: validated.variantId,
        quantity: validated.quantity,
      },
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
      { requestId, status: 200 },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
