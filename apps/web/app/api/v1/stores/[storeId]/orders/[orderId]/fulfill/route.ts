import {
  NotificationOutboxService,
  OrderLifecycleCoordinator,
} from "@calcart/orders";
import { ReservationReleaseService } from "@calcart/inventory";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  fulfillOrderValidator,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
  validateUuid,
} from "@/lib/api";

const orderLifecycleCoordinator = new OrderLifecycleCoordinator(
  undefined,
  new ReservationReleaseService(),
);
const notificationOutboxService = new NotificationOutboxService();

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

    const body = await validateBody(req, fulfillOrderValidator);

    // Tracking is now persisted as structured columns on the order; the audit
    // history reason captures only the merchant note (GAP-04).
    const auditReason = body.reason?.trim() || "Order marked fulfilled by merchant";

    // Fulfilling also commits the stock reserved for the order, atomically.
    const order = await orderLifecycleCoordinator.fulfill(ctx.db, {
      storeId,
      orderId,
      fulfillmentStatus: body.fulfillmentStatus ?? "FULFILLED",
      trackingCarrier: body.trackingCompany ?? null,
      trackingNumber: body.trackingNumber ?? null,
      trackingUrl: body.trackingUrl ?? null,
      actorType: "MERCHANT",
      actorId: auth.user.id,
      reason: auditReason,
    });

    // Queue Order Fulfillment notification asynchronously into outbox (idempotent, fail-open)
    await notificationOutboxService.queueOrderFulfillment(ctx.db, {
      storeId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      fulfillmentStatus: order.fulfillmentStatus,
      // Use the persisted values rather than the request body: tracking columns
      // are COALESCE-updated, so a re-fulfilment that omits tracking retains
      // the previously stored carrier details and the email must match.
      carrier: order.trackingCarrier ?? null,
      trackingNumber: order.trackingNumber ?? null,
      trackingUrl: order.trackingUrl ?? null,
      items: order.items?.map((item) => ({
        name: item.productNameSnapshot,
        variantTitle: item.variantNameSnapshot,
        sku: item.skuSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
    });

    return apiSuccess(order, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
