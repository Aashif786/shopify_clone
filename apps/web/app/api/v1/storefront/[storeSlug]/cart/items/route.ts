import { CartService } from "@shopify-clone/carts";
import { generateUuidV7 } from "@shopify-clone/db";
import { StoreService } from "@shopify-clone/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";
import { enrichCart } from "@/lib/storefront-cart-helpers";

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

    const body = (await req.json()) as {
      variantId?: string;
      quantity?: number;
      cartId?: string;
      guestIdentifier?: string;
    };

    if (!body || typeof body !== "object") {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Request body is required");
    }

    if (!body.variantId || typeof body.variantId !== "string") {
      throw new ApiHttpError(
        400,
        "VALIDATION_ERROR",
        "variantId is required",
        { fields: { variantId: "Product variant ID is required" } },
      );
    }
    validateUuid(body.variantId, "variantId");

    const quantity = body.quantity ?? 1;
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 999
    ) {
      throw new ApiHttpError(
        400,
        "INVALID_QUANTITY",
        "Quantity must be a positive integer between 1 and 999",
        { fields: { quantity: "Quantity must be between 1 and 999" } },
      );
    }

    // Resolve or create cart
    let activeCartId = body.cartId;
    if (activeCartId) {
      try {
        const existing = await cartService.getCart(ctx.db, store.id, activeCartId);
        if (existing.status !== "ACTIVE") {
          activeCartId = undefined;
        }
      } catch {
        activeCartId = undefined;
      }
    }

    if (!activeCartId) {
      const guestId = body.guestIdentifier || generateUuidV7();
      const newCart = await cartService.getOrCreateCart(ctx.db, store.id, {
        customerId: ctx.auth?.user?.id ?? null,
        guestIdentifier: guestId,
        currency: store.currency,
      });
      activeCartId = newCart.id;
    }

    const updated = await cartService.addItem(ctx.db, store.id, activeCartId, {
      variantId: body.variantId,
      quantity,
    });

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
