import { CollectionService } from "@calcart/products";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  addCollectionProductValidator,
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";

const collectionService = new CollectionService();

interface RouteContext {
  params: Promise<{ storeId: string; collectionId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, collectionId } = await Promise.resolve(context.params);

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const productIds = await collectionService.listCollectionProductIds(
      ctx.db,
      storeId,
      collectionId,
    );

    return apiSuccess({ productIds }, { requestId });
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
    const { storeId, collectionId } = await Promise.resolve(context.params);

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, addCollectionProductValidator);
    await collectionService.addProductToCollection(
      ctx.db,
      storeId,
      collectionId,
      body.productId,
      body.position ?? 0,
    );

    return apiSuccess({ added: true }, { status: 201, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
