import { ShipmentService } from "@calcart/orders";
import { CompositeCarrierProvider } from "@calcart/shipping";
import { PaymentOrderIntegration } from "@calcart/payments";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const shipmentService = new ShipmentService(new CompositeCarrierProvider());
const paymentOrderIntegration = new PaymentOrderIntegration();

interface RouteContext {
  params: Promise<{ storeId: string; orderId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId, orderId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(orderId, "orderId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "staff")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least staff role in this store",
      );
    }

    const body = (await req.json()) as {
      status?: string;
      carrierStatus?: string;
      reason?: string;
    };

    if (!body || !body.status) {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Field 'status' is required");
    }

    const targetStatus = body.status.toUpperCase();
    let result;

    if (targetStatus === "DELIVERED") {
      result = await shipmentService.markDelivered(ctx.db, {
        storeId,
        orderId,
        carrierStatus: body.carrierStatus,
        actorType: "MERCHANT",
        actorId: auth.user.id,
        reason: body.reason,
      });

      // If the delivered order was COD (paymentStatus: PENDING), automatically reconcile payment
      if (result.order.paymentStatus === "PENDING") {
        try {
          const paymentResult = await paymentOrderIntegration.markCodPaymentCollected(ctx.db, {
            storeId,
            orderId,
            actorId: auth.user.id,
            reason: "Cash collected upon verified delivery",
          });
          result.order = paymentResult.order;
        } catch (e) {
          console.error(`[shipment/status] Failed to auto-reconcile COD payment for delivered order ${orderId}:`, e);
        }
      }
    } else if (targetStatus === "DELIVERY_FAILED") {
      result = await shipmentService.markDeliveryFailed(ctx.db, {
        storeId,
        orderId,
        carrierStatus: body.carrierStatus,
        actorType: "MERCHANT",
        actorId: auth.user.id,
        reason: body.reason,
      });
    } else {
      throw new ApiHttpError(
        400,
        "INVALID_SHIPMENT_STATUS",
        "Status must be either 'DELIVERED' or 'DELIVERY_FAILED'",
      );
    }

    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
