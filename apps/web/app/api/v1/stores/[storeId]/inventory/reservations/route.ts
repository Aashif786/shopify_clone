import { InventoryService } from "@shopify-clone/inventory";
import {
  ApiHttpError,
  apiSuccess,
  createReservationValidator,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
  validateUuid,
} from "@/lib/api";

const inventoryService = new InventoryService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const body = await validateBody(req, createReservationValidator);

    let referenceType = body.referenceType;
    let referenceId = body.referenceId;

    if (!referenceId && ctx.idempotencyKey) {
      referenceType = referenceType ?? "idempotency_key";
      referenceId = ctx.idempotencyKey;
    }

    if (!referenceType || !referenceId) {
      throw new ApiHttpError(
        400,
        "VALIDATION_ERROR",
        "referenceType and referenceId (or Idempotency-Key header) are required for reservations",
        {
          fields: {
            referenceType: "referenceType is required",
            referenceId: "referenceId is required",
          },
        },
      );
    }

    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    if (body.items && body.items.length > 0) {
      const reservations = await inventoryService.reserveMany(
        ctx.db,
        storeId,
        {
          items: body.items,
          referenceType,
          referenceId,
          expiresAt,
        },
      );
      return apiSuccess({ reservations }, { status: 201, requestId });
    }

    const reservation = await inventoryService.reserve(ctx.db, storeId, {
      variantId: body.variantId!,
      quantity: body.quantity!,
      referenceType,
      referenceId,
      expiresAt,
    });

    return apiSuccess(reservation, { status: 201, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
