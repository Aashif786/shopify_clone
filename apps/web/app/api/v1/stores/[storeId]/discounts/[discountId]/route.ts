import { DiscountService } from "@calcart/discounts";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  updateDiscountValidator,
  validateBody,
  validateUuid,
} from "@/lib/api";

const discountService = new DiscountService();

interface RouteContext {
  params: Promise<{ storeId: string; discountId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, discountId } = await Promise.resolve(context.params);
    validateUuid(discountId, "discountId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const discount = await discountService.getDiscountById(ctx.db, storeId, discountId);
    if (!discount) {
      throw new ApiHttpError(404, "DISCOUNT_NOT_FOUND", `Discount '${discountId}' not found`);
    }

    return apiSuccess(discount, { requestId });
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
    const { storeId, discountId } = await Promise.resolve(context.params);
    validateUuid(discountId, "discountId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, updateDiscountValidator);
    const updated = await discountService.updateDiscount(ctx.db, storeId, discountId, body);

    return apiSuccess(updated, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
