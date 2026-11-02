import { CustomerService, WishlistService } from "@calcart/customers";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
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
    interface RawWishlistItem {
      productId?: unknown;
      variantId?: unknown;
    }
    const rawItems = (Array.isArray(body.items) ? body.items : []) as RawWishlistItem[];

    const items = rawItems
      .filter((i): i is { productId: string; variantId?: unknown } => typeof i?.productId === "string")
      .map((i) => ({
        productId: i.productId.trim(),
        variantId: typeof i.variantId === "string" ? i.variantId.trim() : null,
      }));

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
