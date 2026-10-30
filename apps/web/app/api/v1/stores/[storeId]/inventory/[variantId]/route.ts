import { InventoryService } from "@calcart/inventory";
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

    const url = new URL(req.url);
    const checkAvailability = url.searchParams.get("availability") === "true";

    if (checkAvailability) {
      const availability = await inventoryService.getAvailability(
        ctx.db,
        storeId,
        variantId,
      );
      return apiSuccess(availability, { requestId });
    }

    const item = await inventoryService.getInventoryItem(
      ctx.db,
      storeId,
      variantId,
    );
    return apiSuccess(item, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
