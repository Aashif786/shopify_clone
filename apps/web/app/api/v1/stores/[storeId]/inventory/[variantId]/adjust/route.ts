import { InventoryService } from "@calcart/inventory";
import {
  adjustInventoryValidator,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
  validateUuid,
} from "@/lib/api";

const inventoryService = new InventoryService();

interface RouteContext {
  params: Promise<{ storeId: string; variantId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId, variantId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(variantId, "variantId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const body = await validateBody(req, adjustInventoryValidator);

    let referenceType = body.referenceType ?? null;
    let referenceId = body.referenceId ?? null;

    if (!referenceId && ctx.idempotencyKey) {
      referenceType = referenceType ?? "idempotency_key";
      referenceId = ctx.idempotencyKey;
    }

    const result = await inventoryService.adjustStock(
      ctx.db,
      storeId,
      variantId,
      {
        quantityDelta: body.quantityDelta,
        reason: body.reason,
        referenceType,
        referenceId,
        createdBy: auth.user.id,
      },
    );

    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
