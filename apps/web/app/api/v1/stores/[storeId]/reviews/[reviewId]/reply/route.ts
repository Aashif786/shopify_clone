import { ReviewService } from "@calcart/products";
import {
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";
import { replyReviewValidator } from "@/lib/api/validation";

const reviewService = new ReviewService();

interface RouteContext {
  params: Promise<{
    storeId: string;
    reviewId: string;
  }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId, reviewId } = await context.params;
    await requireStoreOrNotFound(ctx, storeId, "staff");

    const input = await validateBody(req, replyReviewValidator);

    const updated = await reviewService.replyToReview(
      ctx.db,
      storeId,
      reviewId,
      auth.user.id,
      input.replyText,
    );

    return apiSuccess(updated, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, reviewId } = await context.params;
    await requireStoreOrNotFound(ctx, storeId, "staff");

    const updated = await reviewService.deleteMerchantReply(
      ctx.db,
      storeId,
      reviewId,
    );

    return apiSuccess(updated, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
