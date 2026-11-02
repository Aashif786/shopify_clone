import { WishlistService } from "@calcart/customers";
import { StoreService } from "@calcart/stores";
import {
  apiSuccess,
  handleApiError,
  resolveRequestContext,
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

    const resolved = await wishlistService.batchResolveItems(ctx.db, store.id, items);

    return apiSuccess({ items: resolved, count: resolved.length }, { status: 200, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
