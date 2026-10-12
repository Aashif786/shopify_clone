import { DiscountService } from "@shopify-clone/discounts";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const discountService = new DiscountService();

interface RouteContext {
  params: Promise<{ storeId: string; discountId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
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

    const deactivated = await discountService.deactivateDiscount(ctx.db, storeId, discountId);
    return apiSuccess(deactivated, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
