import { ProductService, ReviewService } from "@calcart/products";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";
import { updateReviewValidator } from "@/lib/api/validation";
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

export async function PATCH(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeSlug, productSlug, reviewId } = await context.params;
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    const product = await productService.getProductBySlug(ctx.db, store.id, productSlug);

    const customer = await resolveStorefrontCustomer(ctx, store.id);

    if (!customer) {
      throw new ApiHttpError(
        401,
        "AUTHENTICATION_REQUIRED",
        "Customer account required to edit a review",
      );
    }

    const input = await validateBody(req, updateReviewValidator);

    const updated = await reviewService.updateCustomerReview(
      ctx.db,
      store.id,
      product.id,
      reviewId,
      customer.id,
      input,
    );

    return apiSuccess(updated, { status: 200, requestId });
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
    const { storeSlug, productSlug, reviewId } = await context.params;
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    const product = await productService.getProductBySlug(ctx.db, store.id, productSlug);

    const customer = await resolveStorefrontCustomer(ctx, store.id);

    if (!customer) {
      throw new ApiHttpError(
        401,
        "AUTHENTICATION_REQUIRED",
        "Customer account required to delete a review",
      );
    }

    await reviewService.deleteCustomerReview(
      ctx.db,
      store.id,
      product.id,
      reviewId,
      customer.id,
    );

    return apiSuccess({ success: true }, { status: 200, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
