import { InventoryService } from "@shopify-clone/inventory";
import {
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const inventoryService = new InventoryService();

interface RouteContext {
  params: Promise<{ storeId: string; itemId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, itemId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(itemId, "itemId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const item = await inventoryService.getInventoryById(
      ctx.db,
      storeId,
      itemId,
    );

    return apiSuccess(item, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
