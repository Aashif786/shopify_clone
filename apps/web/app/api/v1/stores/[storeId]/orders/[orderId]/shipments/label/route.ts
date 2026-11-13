import { OrderService, ShipmentService } from "@calcart/orders";
import { StoreService } from "@calcart/stores";
import { TaxService } from "@calcart/tax";
import { CompositeCarrierProvider, ShippingLabelService } from "@calcart/shipping";
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

const orderService = new OrderService();
const storeService = new StoreService();
const taxService = new TaxService();
const shipmentService = new ShipmentService(new CompositeCarrierProvider());
const shippingLabelService = new ShippingLabelService();

interface RouteContext {
  params: Promise<{ storeId: string; orderId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
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

    const [order, shipment, store] = await Promise.all([
      orderService.getOrderById(ctx.db, storeId, orderId),
      shipmentService.findByOrder(ctx.db, storeId, orderId),
      storeService.getStoreById(ctx.db, storeId, auth.user.id),
    ]);

    if (!order) {
      throw new ApiHttpError(404, "ORDER_NOT_FOUND", "Order not found");
    }
    if (!shipment) {
      throw new ApiHttpError(
        404,
        "SHIPMENT_NOT_FOUND",
        "This order has not been dispatched yet. Dispatch order to generate label.",
      );
    }

    let gstin: string | null = null;
    try {
      const taxSettings = await taxService.getSettings(ctx.db, storeId);
      gstin = taxSettings.gstin;
    } catch {
      // Best-effort GSTIN resolution
    }

    const shippingAddr =
      order.addresses?.find((a) => a.type === "SHIPPING") ??
      order.addresses?.find((a) => a.type === "BILLING");

    if (!shippingAddr) {
      throw new ApiHttpError(
        400,
        "SHIPPING_ADDRESS_MISSING",
        "Order does not have a destination shipping address",
      );
    }

    const isCod = order.paymentStatus === "PENDING";
    const codAmount = isCod ? order.total : 0;

    const labelData = {
      orderNumber: order.orderNumber,
      orderDate: new Date(order.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      carrierName: shipment.carrierName,
      trackingNumber: shipment.trackingNumber || `AWB-${order.orderNumber}`,
      trackingUrl: shipment.trackingUrl,
      carrierStatus: shipment.carrierStatus,
      isCod,
      codAmount,
      currency: order.currency,
      totalWeightGrams: 500,
      store: {
        name: store.name,
        gstin,
      },
      recipient: {
        name: shippingAddr.name,
        addressLine1: shippingAddr.addressLine1,
        addressLine2: shippingAddr.addressLine2,
        city: shippingAddr.city,
        state: shippingAddr.state,
        postalCode: shippingAddr.postalCode,
        country: shippingAddr.country,
        phone: shippingAddr.phone,
      },
      items: (order.items || []).map((item) => ({
        name: item.productNameSnapshot,
        variantTitle: item.variantNameSnapshot,
        sku: item.skuSnapshot,
        quantity: item.quantity,
        price: item.unitPrice,
      })),
    };

    const labelHtml = shippingLabelService.renderHtmlShippingLabel(labelData);

    const url = new URL(req.url);
    const format = url.searchParams.get("format");
    const acceptHeader = req.headers.get("accept") || "";

    if (format === "json" && !acceptHeader.includes("text/html")) {
      return apiSuccess({ labelHtml, data: labelData }, { requestId });
    }

    return new Response(labelHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
