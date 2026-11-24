import { ReturnService } from "@calcart/returns";
import { OrderService } from "@calcart/orders";
import { StoreService } from "@calcart/stores";
import { TaxService } from "@calcart/tax";
import { ShippingLabelService, ShippingService } from "@calcart/shipping";
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
const shippingService = new ShippingService();
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

    // Load store physical return address from tax_settings
    let taxSettings;
    try {
      taxSettings = await taxService.getSettings(ctx.db, store.id);
    } catch {
      taxSettings = null;
    }

    if (
      !taxSettings?.addressLine1?.trim() ||
      !taxSettings?.city?.trim() ||
      !taxSettings?.postalCode?.trim()
    ) {
      throw new ApiHttpError(
        422,
        "RETURN_ADDRESS_NOT_CONFIGURED",
        "Store return address is not configured. Please contact the store for return instructions.",
      );
    }

    const customerAddr =
      order.addresses?.find((a) => a.type === "SHIPPING") ??
      order.addresses?.find((a) => a.type === "BILLING");

    // Compute total weight from product shipping profiles and default weight setting
    let totalWeightGrams = 500;
    try {
      const shippingSettings = await shippingService.getSettings(ctx.db, store.id);
      const defaultWeight = shippingSettings.defaultWeightGrams ?? 500;
      const orderItemsById = new Map((order.items || []).map((item) => [item.id, item]));

      const returnedProductLines = (returnReq.items || []).map((item) => {
        const orderItem = item.orderItemId ? orderItemsById.get(item.orderItemId) : null;
        return {
          productId: orderItem?.productId ?? null,
          quantity: item.quantity,
        };
      });

      const productIds = Array.from(
        new Set(
          returnedProductLines
            .map((line) => line.productId)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      const profiles =
        productIds.length > 0
          ? await shippingService.listProductProfiles(ctx.db, store.id, productIds)
          : [];
      const weightByProduct = new Map(profiles.map((p) => [p.productId, p.weightGrams]));

      const computedWeight = returnedProductLines.reduce((sum, line) => {
        const unit = line.productId
          ? (weightByProduct.get(line.productId) ?? defaultWeight)
          : defaultWeight;
        return sum + unit * line.quantity;
      }, 0);

      totalWeightGrams = computedWeight > 0 ? computedWeight : defaultWeight;
    } catch {
      totalWeightGrams = 500;
    }

    const storeSettings = store.settings as { contactPhone?: string } | null;

    const labelData = {
      orderNumber: returnReq.returnNumber,
      orderDate: new Date(returnReq.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      carrierName: "Store Return Authorization",
      trackingNumber: `RET-${returnReq.returnNumber.replace(/[^A-Za-z0-9]/g, "")}`,
      trackingUrl: null,
      carrierStatus: "Return Authorized",
      isCod: false,
      codAmount: 0,
      currency: returnReq.currency,
      totalWeightGrams,
      store: {
        name: customerAddr ? customerAddr.name : "Customer",
        city: customerAddr?.city ?? "City",
        state: customerAddr?.state ?? null,
        postalCode: customerAddr?.postalCode ?? "000000",
        country: customerAddr?.country ?? "IN",
        phone: customerAddr?.phone ?? null,
        gstin: taxSettings.gstin ?? null,
      },
      recipient: {
        name: taxSettings.legalName?.trim() || `${store.name} Returns Processing`,
        addressLine1: taxSettings.addressLine1.trim(),
        addressLine2: taxSettings.addressLine2?.trim() || null,
        city: taxSettings.city.trim(),
        state: taxSettings.stateCode || taxSettings.stateName || null,
        postalCode: taxSettings.postalCode.trim(),
        country: "IN",
        phone: storeSettings?.contactPhone ?? null,
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
