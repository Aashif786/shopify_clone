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

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    const body = (await req.json()) as {
      quantity?: number;
      cartId?: string;
    };

    if (!body || typeof body !== "object") {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Request body is required");
    }

    if (!body.cartId || typeof body.cartId !== "string") {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "cartId is required");
    }
    validateUuid(body.cartId, "cartId");

    const quantity = body.quantity;
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > 999
    ) {
      throw new ApiHttpError(
        400,
        "INVALID_QUANTITY",
        "Quantity must be an integer between 0 and 999",
      );
    }

    const updated = await cartService.updateItemQuantity(
      ctx.db,
      store.id,
      body.cartId,
      itemId,
      quantity,
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

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    const url = new URL(req.url);
    let cartId = url.searchParams.get("cartId") || req.headers.get("x-cart-id");
    if (!cartId) {
      try {
        const body = (await req.json()) as { cartId?: string };
        cartId = body.cartId || null;
      } catch {
        // no json body
      }
    }

    if (!cartId) {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "cartId is required");
    }
    validateUuid(cartId, "cartId");

    const updated = await cartService.removeItem(
      ctx.db,
      store.id,
      cartId,
      itemId,
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
