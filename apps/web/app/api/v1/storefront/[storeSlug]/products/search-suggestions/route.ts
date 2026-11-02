import { ProductService } from "@calcart/products";
import { StoreService } from "@calcart/stores";
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

    const url = new URL(req.url);
    const query = url.searchParams.get("q") || url.searchParams.get("query") || url.searchParams.get("search") || "";
    if (!query.trim()) {
      return apiSuccess(
        {
          query: "",
          suggestions: [],
        },
        { requestId },
      );
    }

    const suggestions = await productService.getSearchSuggestions(
      ctx.db,
      store.id,
      query.trim(),
    );

    return apiSuccess(suggestions, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
