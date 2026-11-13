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
  shippingRateValidator,
} from "@/lib/api";
import { ShippingService } from "@calcart/shipping";

const shippingService = new ShippingService();

interface RouteContext {
  params: Promise<{ storeId: string; rateId: string }>;
}

/** Replaces a rate's definition. */
export async function PUT(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, rateId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(rateId, "rateId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, shippingRateValidator);
    const result = await shippingService.updateRate(ctx.db, storeId, rateId, body);
    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

/** Deletes a rate. Quotes already frozen on checkouts are unaffected. */
export async function DELETE(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, rateId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(rateId, "rateId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    await shippingService.deleteRate(ctx.db, storeId, rateId);
    const result = { rateId, deleted: true };
    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
