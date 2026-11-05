import { StoreService } from "@calcart/stores";
import { OrderService } from "@calcart/orders";
import {
  ApiHttpError,
  handleApiError,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";
import {
  assertOrderOwnership,
  extractGuestToken,
  resolveStorefrontCustomer,
} from "@/lib/storefront-auth-helpers";
import { invoiceResponse, loadOrIssueInvoice } from "@/lib/tax-invoice-response";

const storeService = new StoreService();
const orderService = new OrderService();

interface RouteContext {
  params: Promise<{ storeSlug: string; orderId: string }>;
}

/**
 * GST tax invoice for the customer who placed the order. Ownership is the same
 * server-side check as the order itself: the signed-in customer, or a matching
 * guest ownership token. A non-owner gets the same 404 as a missing order, so
 * order ids cannot be probed.
 */
export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, orderId } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }
    validateUuid(orderId, "orderId");

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    const order = await orderService.getOrderById(ctx.db, store.id, orderId);
    if (!order || order.storeId !== store.id) {
      throw new ApiHttpError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const guestToken = extractGuestToken(req);
    assertOrderOwnership(order, { customer, guestToken });

    const invoice = await loadOrIssueInvoice(ctx.db, store.id, order);
    return invoiceResponse(req, invoice, requestId);
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
