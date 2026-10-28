import { ProductService, ReviewService, type ReviewSortBy } from "@shopify-clone/products";
import { StoreService } from "@shopify-clone/stores";
import {
  apiSuccess,
  handleApiError,
  requireAuth,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";
import { createReviewValidator } from "@/lib/api/validation";
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

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(50, parseInt(url.searchParams.get("limit") || "10", 10)));
    const sortBy = (url.searchParams.get("sortBy") as ReviewSortBy) || "newest";
    const ratingParam = url.searchParams.get("rating");
    const rating = ratingParam ? parseInt(ratingParam, 10) : undefined;

    const [{ items, total }, summary] = await Promise.all([
      reviewService.listPublishedReviews(ctx.db, store.id, product.id, {
        page,
        limit,
        sortBy,
        rating,
      }),
      reviewService.getProductReviewSummary(ctx.db, store.id, product.id),
    ]);

    return apiSuccess(
      {
        items,
        total,
        page,
        limit,
        summary,
      },
      { status: 200, requestId },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeSlug, productSlug } = await context.params;
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    const product = await productService.getProductBySlug(ctx.db, store.id, productSlug);

    const customer = await resolveStorefrontCustomer(ctx, store.id);

    if (!customer) {
      return handleApiError(
        new Error("Customer account required to write a review"),
        requestId,
      );
    }

    const input = await validateBody(req, createReviewValidator);

    const review = await reviewService.submitReview(
      ctx.db,
      store.id,
      product.id,
      customer.id,
      input,
    );

    return apiSuccess(review, { status: 201, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
