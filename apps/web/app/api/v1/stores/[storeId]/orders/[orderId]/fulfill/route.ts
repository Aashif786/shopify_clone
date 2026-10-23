import { OrderStatusService } from "@shopify-clone/orders";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
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

const orderStatusService = new OrderStatusService();

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

    const trackingParts: string[] = [];
    if (body.trackingCompany) trackingParts.push(`Carrier: ${body.trackingCompany}`);
    if (body.trackingNumber) trackingParts.push(`Tracking #: ${body.trackingNumber}`);
    if (body.reason) trackingParts.push(body.reason);
    const auditReason =
      trackingParts.length > 0
        ? trackingParts.join(" | ")
        : "Order marked fulfilled by merchant";

    const order = await orderStatusService.updateFulfillmentStatus(ctx.db, {
      storeId,
      orderId,
      fulfillmentStatus: body.fulfillmentStatus ?? "FULFILLED",
      actorType: "MERCHANT",
      actorId: auth.user.id,
      reason: auditReason,
    });

    return apiSuccess(order, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
