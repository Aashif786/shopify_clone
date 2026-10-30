import { ReviewService } from "@calcart/products";
import {
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
} from "@/lib/api";

const reviewService = new ReviewService();

interface RouteContext {
  params: Promise<{
    storeId: string;
    reviewId: string;
  }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, reviewId } = await context.params;
    await requireStoreOrNotFound(ctx, storeId, "staff");

    const review = await reviewService.getMerchantReviewById(ctx.db, storeId, reviewId);
    return apiSuccess(review, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
