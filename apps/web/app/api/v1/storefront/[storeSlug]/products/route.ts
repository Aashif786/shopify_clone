import { ProductService, type ProductSortOption } from "@shopify-clone/products";
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

function parseSortBy(param: string | null): ProductSortOption | undefined {
  if (!param) return undefined;
  switch (param.toLowerCase()) {
    case "created_at_desc":
    case "newest":
    case "featured":
      return "created_at_desc";
    case "created_at_asc":
    case "oldest":
      return "created_at_asc";
    case "price_asc":
    case "price_low_high":
    case "price-asc":
      return "price_asc";
    case "price_desc":
    case "price_high_low":
    case "price-desc":
      return "price_desc";
    case "title_asc":
    case "title-asc":
    case "name_asc":
    case "alpha_asc":
      return "title_asc";
    case "title_desc":
    case "title-desc":
    case "name_desc":
    case "alpha_desc":
      return "title_desc";
    default:
      return undefined;
  }
}

function parsePrice(param: string | null, name: string): number | undefined {
  if (!param) return undefined;
  const num = Number(param);
  if (!Number.isInteger(num) || num < 0) {
    throw new ApiHttpError(400, "INVALID_PRICE_FILTER", `${name} must be a non-negative integer`);
  }
  return num;
}

function parseBoolean(param: string | null): boolean | undefined {
  if (!param) return undefined;
  const lower = param.toLowerCase();
  if (lower === "true" || lower === "1") return true;
  if (lower === "false" || lower === "0") return false;
  return undefined;
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

    // Parse query parameters
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const cursor = url.searchParams.get("cursor") || undefined;
    const search = url.searchParams.get("search") || url.searchParams.get("q") || undefined;
    const minPrice = parsePrice(url.searchParams.get("minPrice"), "minPrice");
    const maxPrice = parsePrice(url.searchParams.get("maxPrice"), "maxPrice");
    const inStock = parseBoolean(url.searchParams.get("inStock"));
    const sortBy = parseSortBy(url.searchParams.get("sortBy") || url.searchParams.get("sort"));
    const collectionSlug = url.searchParams.get("collection") || undefined;

    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      throw new ApiHttpError(400, "INVALID_PRICE_RANGE", "minPrice cannot be greater than maxPrice");
    }

    let limit = 20;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 100);
      }
    }

    // Public catalog strictly retrieves ACTIVE (published) products
    const result = await productService.listProducts(ctx.db, store.id, {
      status: "ACTIVE",
      limit,
      cursor,
      search,
      minPrice,
      maxPrice,
      inStock,
      sortBy,
      collectionSlug,
    });

    return apiSuccess(
      {
        items: result.items,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
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

