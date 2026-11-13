import { ReturnService } from "@calcart/returns";
import { OrderService } from "@calcart/orders";
import { StoreService } from "@calcart/stores";
import { TaxService } from "@calcart/tax";
import { ShippingLabelService } from "@calcart/shipping";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";
import {
  assertOrderOwnership,
  extractGuestToken,
  resolveStorefrontCustomer,
} from "@/lib/storefront-auth-helpers";

const returnService = new ReturnService();
const orderService = new OrderService();
const storeService = new StoreService();
const taxService = new TaxService();
const shippingLabelService = new ShippingLabelService();

interface RouteContext {
  params: Promise<{ storeSlug: string; returnId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, returnId } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }
    validateUuid(returnId, "returnId");

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(404, "STORE_NOT_FOUND", "Store is not publicly available");
    }

    const returnReq = await returnService.getReturnRequest(ctx.db, store.id, returnId);
    if (!returnReq) {
      throw new ApiHttpError(404, "RETURN_NOT_FOUND", "Return request not found");
    }

    const order = await orderService.getOrderById(ctx.db, store.id, returnReq.orderId);
    if (!order) {
      throw new ApiHttpError(404, "ORDER_NOT_FOUND", "Associated order not found");
    }

    // Customer / Guest authorization
    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const guestToken = extractGuestToken(req);
    assertOrderOwnership(order, { customer, guestToken });

    if (returnReq.status !== "APPROVED") {
      throw new ApiHttpError(
        400,
        "RETURN_NOT_APPROVED",
        `Return label is only available for approved returns (current status: '${returnReq.status}')`,
      );
    }

    let gstin: string | null = null;
    try {
      const taxSettings = await taxService.getSettings(ctx.db, store.id);
      gstin = taxSettings.gstin;
    } catch {
      // Best effort GSTIN
    }

    const customerAddr =
      order.addresses?.find((a) => a.type === "SHIPPING") ??
      order.addresses?.find((a) => a.type === "BILLING");

    const labelData = {
      orderNumber: returnReq.returnNumber,
      orderDate: new Date(returnReq.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      carrierName: "Delhivery Reverse Logistics",
      trackingNumber: `RET-${returnReq.returnNumber.replace(/[^A-Za-z0-9]/g, "")}`,
      trackingUrl: `https://www.delhivery.com/track/package/RET-${returnReq.returnNumber.replace(/[^A-Za-z0-9]/g, "")}`,
      carrierStatus: "Reverse Pickup Authorized",
      isCod: false,
      codAmount: 0,
      currency: returnReq.currency,
      totalWeightGrams: 500,
      store: {
        name: customerAddr ? customerAddr.name : "Customer",
        city: customerAddr?.city ?? "City",
        state: customerAddr?.state ?? null,
        postalCode: customerAddr?.postalCode ?? "000000",
        country: customerAddr?.country ?? "IN",
        phone: customerAddr?.phone ?? null,
        gstin,
      },
      recipient: {
        name: `${store.name} Returns Processing`,
        addressLine1: "Central Warehouse Returns Dock",
        addressLine2: null,
        city: "Mumbai",
        state: "MH",
        postalCode: "400001",
        country: "IN",
        phone: null,
      },
      items: (returnReq.items || []).map((item) => ({
        name: item.productNameSnapshot,
        variantTitle: item.variantNameSnapshot,
        sku: item.skuSnapshot,
        quantity: item.quantity,
        price: item.unitPriceSnapshot,
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
