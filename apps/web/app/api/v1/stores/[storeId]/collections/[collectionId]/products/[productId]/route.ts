import { CollectionService } from "@shopify-clone/products";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
} from "@/lib/api";

const collectionService = new CollectionService();

interface RouteContext {
  params: Promise<{
    storeId: string;
    collectionId: string;
    productId: string;
  }>;
}

export async function DELETE(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, collectionId, productId } = await Promise.resolve(context.params);

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const removed = await collectionService.removeProductFromCollection(
      ctx.db,
      storeId,
      collectionId,
      productId,
    );

    return apiSuccess({ removed }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
