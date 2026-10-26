import { ReviewService } from "@shopify-clone/products";
import {
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";
import { moderateReviewValidator } from "@/lib/api/validation";

const reviewService = new ReviewService();

interface RouteContext {
  params: Promise<{
    storeId: string;
    reviewId: string;
  }>;
}

export async function PATCH(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId, reviewId } = await context.params;
    await requireStoreOrNotFound(ctx, storeId, "staff");

    const input = await validateBody(req, moderateReviewValidator);

    const updated = await reviewService.moderateReview(
      ctx.db,
      storeId,
      reviewId,
      auth.user.id,
      input,
    );

    return apiSuccess(updated, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
