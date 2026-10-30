import { ReviewService, type ReviewSortBy, type ReviewStatus } from "@calcart/products";
import {
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
} from "@/lib/api";

const reviewService = new ReviewService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await context.params;
    await requireStoreOrNotFound(ctx, storeId, "staff");

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") || "20", 10)));
    const productId = url.searchParams.get("productId") || undefined;
    const status = (url.searchParams.get("status") as ReviewStatus) || undefined;
    const ratingParam = url.searchParams.get("rating");
    const rating = ratingParam ? parseInt(ratingParam, 10) : undefined;
    const search = url.searchParams.get("search") || undefined;
    const sortBy = (url.searchParams.get("sortBy") as ReviewSortBy) || "newest";

    const result = await reviewService.listMerchantReviews(ctx.db, storeId, {
      productId,
      status,
      rating,
      search,
      page,
      limit,
      sortBy,
    });

    return apiSuccess(
      {
        items: result.items,
        total: result.total,
        page,
        limit,
        stats: result.stats,
      },
      { requestId },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
