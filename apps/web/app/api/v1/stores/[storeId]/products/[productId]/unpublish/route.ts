import { ProductService } from "@shopify-clone/products";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
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

    const unpublished = await productService.unpublishProduct(
      ctx.db,
      storeId,
      productId,
    );

    return apiSuccess(unpublished, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
