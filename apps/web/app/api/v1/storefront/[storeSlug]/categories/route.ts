import { ProductService } from "@shopify-clone/products";
import { StoreService } from "@shopify-clone/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
} from "@/lib/api";

const storeService = new StoreService();
const productService = new ProductService();

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug } = await Promise.resolve(context.params);
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(404, "STOREFRONT_NOT_FOUND", "Store is not publicly available");
    }

    const categories = await productService.listCategories(ctx.db, store.id);
    return apiSuccess({ items: categories }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
