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
  params: Promise<{ storeSlug: string; productSlug: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, productSlug } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }
    if (!productSlug) {
      throw new ApiHttpError(400, "INVALID_PRODUCT_SLUG", "Product slug is required");
    }

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    // Resolve product strictly within the store
    const product = await productService.getProductBySlug(
      ctx.db,
      store.id,
      productSlug,
    );

    // Customer storefront visibility check: only ACTIVE (published) products are accessible
    if (product.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "PRODUCT_NOT_FOUND",
        "Product not found or unavailable",
      );
    }

    // Only expose active variants to customers
    const activeVariants = product.variants.filter((v) => v.status === "ACTIVE");

    return apiSuccess(
      {
        product: {
          ...product,
          variants: activeVariants,
        },
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
