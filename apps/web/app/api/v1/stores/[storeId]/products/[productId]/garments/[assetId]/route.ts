import { GarmentAssetService } from "@calcart/products";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  parseJsonBody,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
} from "@/lib/api";
import { removeGarmentFile } from "@/lib/garment-storage";

const garmentService = new GarmentAssetService();

interface RouteContext {
  params: Promise<{ storeId: string; productId: string; assetId: string }>;
}

async function authorize(req: Request, context: RouteContext) {
  const ctx = await resolveRequestContext(req);
  requireAuth(ctx);
  const params = await Promise.resolve(context.params);
  const member = await requireStoreOrNotFound(ctx, params.storeId);
  if (!hasRoleAtLeast(member.role, "admin")) {
    throw new ApiHttpError(403, "FORBIDDEN", "Operation requires at least admin role in this store");
  }
  return { ctx, ...params };
}

/** Enables or disables a garment without deleting it. */
export async function PATCH(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const { ctx, storeId, assetId } = await authorize(req, context);
    requestId = ctx.requestId;
    const body = await parseJsonBody<{ isEnabled?: unknown }>(req);
    if (typeof body?.isEnabled !== "boolean") {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "isEnabled must be a boolean");
    }
    const asset = await garmentService.setEnabled(ctx.db, storeId, assetId, body.isEnabled);
    return apiSuccess({ asset }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const { ctx, storeId, assetId } = await authorize(req, context);
    requestId = ctx.requestId;
    const { fileName } = await garmentService.removeAsset(ctx.db, storeId, assetId);
    await removeGarmentFile(storeId, fileName);
    return apiSuccess({ deleted: true }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
