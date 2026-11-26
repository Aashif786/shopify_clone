import { GarmentAssetService } from "@calcart/products";
import { StoreService, StoreTypeService } from "@calcart/stores";
import { ApiHttpError, apiSuccess, handleApiError, resolveRequestContext } from "@/lib/api";

const storeService = new StoreService();
const storeTypeService = new StoreTypeService();
const garmentService = new GarmentAssetService();

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

/**
 * Public. Lists products that have a try-on garment (unsupported products are absent), or with
 * `?productId=&variantId=` resolves the garment for one selection (variant first, then product).
 */
export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;
    const { storeSlug } = await Promise.resolve(context.params);
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") throw new ApiHttpError(404, "STORE_NOT_FOUND", "Store not found");

    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");
    const variantId = url.searchParams.get("variantId");

    if (!(await storeTypeService.isFitCheckActive(ctx.db, store.id))) {
      return apiSuccess(productId ? { asset: null } : { items: [] }, { requestId });
    }

    if (productId) {
      const asset = await garmentService.resolveForStorefront(ctx.db, store.id, productId, variantId);
      return apiSuccess({ asset }, { requestId });
    }
    return apiSuccess({ items: await garmentService.listStorefrontCatalog(ctx.db, store.id) }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
