import { CollectionService } from "@calcart/products";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  updateCollectionValidator,
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

    const collection = await collectionService.getCollectionById(
      ctx.db,
      storeId,
      collectionId,
    );

    return apiSuccess(collection, { requestId });
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
    const { storeId, collectionId } = await Promise.resolve(context.params);

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, updateCollectionValidator);
    const updated = await collectionService.updateCollection(
      ctx.db,
      storeId,
      collectionId,
      body,
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
    const { storeId, collectionId } = await Promise.resolve(context.params);

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    await collectionService.deleteCollection(ctx.db, storeId, collectionId);

    return apiSuccess({ deleted: true }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
