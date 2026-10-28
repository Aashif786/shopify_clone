import { ProductService, ReviewService } from "@shopify-clone/products";
import { StoreService } from "@shopify-clone/stores";
import { apiSuccess, handleApiError, resolveRequestContext } from "@/lib/api";
import { resolveStorefrontCustomer } from "@/lib/storefront-auth-helpers";

const storeService = new StoreService();
const productService = new ProductService();
const reviewService = new ReviewService();

interface RouteContext {
  params: Promise<{
    storeSlug: string;
    productSlug: string;
  }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, productSlug } = await context.params;
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    const product = await productService.getProductBySlug(ctx.db, store.id, productSlug);

    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const customerId = customer ? customer.id : null;

    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");

    const eligibility = await reviewService.checkEligibility(
      ctx.db,
      store.id,
      product.id,
      customerId,
      orderId,
    );

    return apiSuccess(
      {
        ...eligibility,
        isAuthenticated: Boolean(ctx.auth?.user?.id),
      },
      { status: 200, requestId },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
