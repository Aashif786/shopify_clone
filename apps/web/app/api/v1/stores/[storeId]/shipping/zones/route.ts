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
  params: Promise<{ storeId: string }>;
}

/** Every zone with its rates, in match order. */
export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const result = { zones: await shippingService.listZones(ctx.db, storeId) };
    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

/** Creates a zone. */
export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, shippingZoneValidator);
    const result = await shippingService.createZone(ctx.db, storeId, body);
    return apiSuccess(result, { requestId, status: 201 });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
