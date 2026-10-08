import { InventoryService } from "@shopify-clone/inventory";
import {
  apiSuccess,
  handleApiError,
  inventoryHistoryQueryValidator,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateQuery,
  validateUuid,
} from "@/lib/api";

const inventoryService = new InventoryService();

interface RouteContext {
  params: Promise<{ storeId: string; variantId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, variantId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(variantId, "variantId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const query = validateQuery(req, inventoryHistoryQueryValidator);
    const adjustments = await inventoryService.listAdjustments(
      ctx.db,
      storeId,
      variantId,
      query.limit,
    );

    return apiSuccess({ items: adjustments }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
