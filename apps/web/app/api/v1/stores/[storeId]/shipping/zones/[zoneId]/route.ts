import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
  validateUuid,
  shippingZoneValidator,
} from "@/lib/api";
import { ShippingService } from "@calcart/shipping";

const shippingService = new ShippingService();

interface RouteContext {
  params: Promise<{ storeId: string; zoneId: string }>;
}

/** Replaces a zone's definition. */
export async function PUT(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, zoneId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(zoneId, "zoneId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, shippingZoneValidator);
    const result = await shippingService.updateZone(ctx.db, storeId, zoneId, body);
    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

/** Deletes a zone and, by cascade, its rates. */
export async function DELETE(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, zoneId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(zoneId, "zoneId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    await shippingService.deleteZone(ctx.db, storeId, zoneId);
    const result = { zoneId, deleted: true };
    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
