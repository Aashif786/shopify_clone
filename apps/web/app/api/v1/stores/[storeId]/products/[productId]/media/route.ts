import { ProductService } from "@shopify-clone/products";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import {
  addProductMediaValidator,
  ApiHttpError,
  apiSuccess,
  handleApiError,
  reorderProductMediaValidator,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";

const productService = new ProductService();

interface RouteContext {
  params: Promise<{ storeId: string; productId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, productId } = await Promise.resolve(context.params);

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, addProductMediaValidator);
    const media = await productService.addMedia(ctx.db, storeId, productId, body);

    return apiSuccess(media, { status: 201, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, productId } = await Promise.resolve(context.params);

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, reorderProductMediaValidator);
    await productService.reorderMedia(ctx.db, storeId, productId, body.mediaIds);

    return apiSuccess({ updated: true }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
