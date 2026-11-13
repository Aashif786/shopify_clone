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
  params: Promise<{ storeId: string; zoneId: string }>;
}

/** Adds a rate to a zone. */
export async function POST(req: Request, context: RouteContext) {
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

    const body = await validateBody(req, shippingRateValidator);
    const result = await shippingService.createRate(ctx.db, storeId, zoneId, body);
    return apiSuccess(result, { requestId, status: 201 });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
