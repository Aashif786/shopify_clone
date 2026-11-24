import { CustomerService, WishlistService } from "@calcart/customers";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const storeService = new StoreService();
const customerService = new CustomerService();
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

    if (!ctx.auth) {
      throw new ApiHttpError(401, "UNAUTHORIZED", "Please sign in to merge wishlist");
    }

    const customer = await customerService.getCustomerByUserId(
      ctx.db,
      store.id,
      ctx.auth.user.id,
    );

    if (!customer) {
      throw new ApiHttpError(404, "CUSTOMER_NOT_FOUND", "Customer profile not found");
    }

    const body = await req.json().catch(() => ({}));
    if (!Array.isArray(body.items)) {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Field 'items' must be an array");
    }
    if (body.items.length > 100) {
      throw new ApiHttpError(
        400,
        "BATCH_LIMIT_EXCEEDED",
        "Cannot merge more than 100 wishlist items at once",
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

    const mergedCount = await wishlistService.mergeGuestWishlist(
      ctx.db,
      store.id,
      customer.id,
      items,
    );

    const updatedItems = await wishlistService.listWishlistItems(ctx.db, store.id, customer.id);

    return apiSuccess({ mergedCount, items: updatedItems }, { status: 200, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
