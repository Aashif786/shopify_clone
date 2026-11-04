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
import {
  REVIEW_REPORT_RATE_LIMIT,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limiter";

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

    const reporterIp = getClientIp(req);
    const ipLimit = enforceRateLimit(
      `storefront:review-report:ip:${reporterIp}`,
      REVIEW_REPORT_RATE_LIMIT.limit,
      REVIEW_REPORT_RATE_LIMIT.windowMs,
      requestId,
    );
    if (ipLimit) {
      return ipLimit;
    }
    const reviewLimit = enforceRateLimit(
      `storefront:review-report:${store.id}:${reviewId}`,
      REVIEW_REPORT_RATE_LIMIT.limit,
      REVIEW_REPORT_RATE_LIMIT.windowMs,
      requestId,
    );
    if (reviewLimit) {
      return reviewLimit;
    }

    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const customerId = customer ? customer.id : null;

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
