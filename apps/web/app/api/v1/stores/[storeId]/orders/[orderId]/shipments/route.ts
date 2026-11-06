import { NotificationOutboxService, OrderLifecycleCoordinator, ShipmentService } from "@calcart/orders";
import { ReservationReleaseService } from "@calcart/inventory";
import { CompositeCarrierProvider } from "@calcart/shipping";
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

const shipmentService = new ShipmentService(
  new CompositeCarrierProvider(),
  new OrderLifecycleCoordinator(undefined, new ReservationReleaseService()),
);
const notificationOutboxService = new NotificationOutboxService();

interface RouteContext {
  params: Promise<{ storeId: string; orderId: string }>;
}

function readOptionalString(value: unknown, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new ApiHttpError(400, "VALIDATION_ERROR", `${field} must be a string`);
  }
  return value;
}

/**
 * The one shipment for this order. Staff and above.
 * Tracking is not exposed here to anonymous callers; the storefront order
 * route returns it only after the customer or guest token is checked.
 */
export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, orderId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(orderId, "orderId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "staff")) {
      throw new ApiHttpError(403, "FORBIDDEN", "Operation requires at least staff role in this store");
    }

    const shipment = await shipmentService.findByOrder(ctx.db, storeId, orderId);
    if (!shipment) {
      throw new ApiHttpError(404, "SHIPMENT_NOT_FOUND", "This order has not been dispatched");
    }

    return apiSuccess(shipment, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

/**
 * Dispatches the whole order through the manual carrier: one shipment, the
 * order moves to SHIPPED, and reserved stock is committed in that transaction.
 * Repeating the call returns the shipment already recorded.
 */
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
      throw new ApiHttpError(403, "FORBIDDEN", "Operation requires at least staff role in this store");
    }

    const body: unknown = await req.json().catch(() => {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
    });
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
    }
    const record = body as Record<string, unknown>;
    const carrierName = readOptionalString(record.carrierName, "carrierName");
    if (!carrierName || carrierName.trim().length === 0) {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "carrierName is required");
    }

    const result = await shipmentService.dispatch(ctx.db, {
      storeId,
      orderId,
      carrierName,
      trackingNumber: readOptionalString(record.trackingNumber, "trackingNumber"),
      trackingUrl: readOptionalString(record.trackingUrl, "trackingUrl"),
      carrierStatus: readOptionalString(record.carrierStatus, "carrierStatus"),
      actorType: "MERCHANT",
      actorId: auth.user.id,
      reason: (() => {
        const reason = readOptionalString(record.reason, "reason");
        if (reason && reason.trim().length > 500) {
          throw new ApiHttpError(400, "VALIDATION_ERROR", "reason cannot exceed 500 characters");
        }
        return reason;
      })(),
    });

    if (result.created) {
      await notificationOutboxService.queueOrderFulfillment(ctx.db, {
        storeId,
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
        fulfillmentStatus: result.order.fulfillmentStatus,
        carrier: result.shipment.carrierName,
        trackingNumber: result.shipment.trackingNumber,
        trackingUrl: result.shipment.trackingUrl,
        items: result.order.items?.map((item) => ({
          name: item.productNameSnapshot,
          variantTitle: item.variantNameSnapshot,
          sku: item.skuSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
      });
    }

    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
