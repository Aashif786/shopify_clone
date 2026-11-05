import { OrderService } from "@calcart/orders";
import {
  ApiHttpError,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";
import { invoiceResponse, loadOrIssueInvoice } from "@/lib/tax-invoice-response";

const orderService = new OrderService();

interface RouteContext {
  params: Promise<{ storeId: string; orderId: string }>;
}

/** GST tax invoice for an order, for merchant staff. */
export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, orderId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(orderId, "orderId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const order = await orderService.getOrderById(ctx.db, storeId, orderId);
    if (!order) {
      throw new ApiHttpError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    const invoice = await loadOrIssueInvoice(ctx.db, storeId, order);
    return invoiceResponse(req, invoice, requestId);
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
