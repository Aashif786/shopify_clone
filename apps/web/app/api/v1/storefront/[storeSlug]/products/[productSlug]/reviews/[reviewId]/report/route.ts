import { ProductService, ReviewService } from "@calcart/products";
import { StoreService } from "@calcart/stores";
import {
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";
import { reportReviewValidator } from "@/lib/api/validation";
import { resolveStorefrontCustomer } from "@/lib/storefront-auth-helpers";

const storeService = new StoreService();
const productService = new ProductService();
const reviewService = new ReviewService();

interface RouteContext {
  params: Promise<{
    storeSlug: string;
    productSlug: string;
    reviewId: string;
  }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, productSlug, reviewId } = await context.params;
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    const product = await productService.getProductBySlug(ctx.db, store.id, productSlug);

    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const customerId = customer ? customer.id : null;

    const reporterIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    const input = await validateBody(req, reportReviewValidator);

    await reviewService.reportReview(
      ctx.db,
      store.id,
      product.id,
      reviewId,
      customerId,
      reporterIp,
      input,
    );

    return apiSuccess({ success: true, message: "Review reported" }, { status: 200, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
