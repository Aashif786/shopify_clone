import { InventoryService } from "@shopify-clone/inventory";
import {
  apiSuccess,
  handleApiError,
  inventoryQueryValidator,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateQuery,
  validateUuid,
} from "@/lib/api";

const inventoryService = new InventoryService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    await requireStoreOrNotFound(ctx, storeId, "staff");
    const query = validateQuery(req, inventoryQueryValidator);

    if (query.itemId) {
      const item = await inventoryService.getInventoryById(
        ctx.db,
        storeId,
        query.itemId,
      );
      return apiSuccess(item, { requestId });
    }

    if (query.variantId) {
      if (query.availability) {
        const availability = await inventoryService.getAvailability(
          ctx.db,
          storeId,
          query.variantId,
        );
        return apiSuccess(availability, { requestId });
      }

      const item = await inventoryService.getInventoryItem(
        ctx.db,
        storeId,
        query.variantId,
      );
      return apiSuccess(item, { requestId });
    }

    const items = await inventoryService.listStoreInventory(ctx.db, storeId, {
      search: query.search,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
    return apiSuccess({ items }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
