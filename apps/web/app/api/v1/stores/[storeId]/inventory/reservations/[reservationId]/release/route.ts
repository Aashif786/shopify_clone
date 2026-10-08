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
  params: Promise<{ storeId: string; reservationId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, reservationId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(reservationId, "reservationId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const released = await inventoryService.releaseReservation(
      ctx.db,
      storeId,
      reservationId,
    );

    return apiSuccess(released, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
