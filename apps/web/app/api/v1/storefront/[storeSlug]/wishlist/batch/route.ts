import { WishlistService } from "@calcart/customers";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const storeService = new StoreService();
const wishlistService = new WishlistService();

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug } = await Promise.resolve(context.params);
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(404, "STOREFRONT_NOT_FOUND", "Store is not publicly available");
    }

    const body = await req.json().catch(() => ({}));
    if (!Array.isArray(body.items)) {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Field 'items' must be an array");
    }
    if (body.items.length > 100) {
      throw new ApiHttpError(
        400,
        "BATCH_LIMIT_EXCEEDED",
        "Cannot batch resolve more than 100 wishlist items at once",
      );
    }

    interface RawWishlistItem {
      productId?: unknown;
      variantId?: unknown;
    }
    const rawItems = body.items as RawWishlistItem[];

    const items = rawItems.map((i, idx) => {
      const prodId = typeof i?.productId === "string" ? i.productId.trim() : "";
      validateUuid(prodId, `items[${idx}].productId`);
      const varId =
        typeof i?.variantId === "string" && i.variantId.trim().length > 0
          ? i.variantId.trim()
          : null;
      if (varId) {
        validateUuid(varId, `items[${idx}].variantId`);
      }
      return {
        productId: prodId,
        variantId: varId,
      };
    });

    const resolved = await wishlistService.batchResolveItems(ctx.db, store.id, items);

    return apiSuccess({ items: resolved, count: resolved.length }, { status: 200, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
