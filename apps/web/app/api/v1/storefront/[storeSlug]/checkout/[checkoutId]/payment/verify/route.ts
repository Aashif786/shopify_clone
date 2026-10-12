import { StoreService } from "@shopify-clone/stores";
import { OrderService } from "@shopify-clone/orders";
import {
  ProviderPaymentService,
  RazorpayPaymentProvider,
  RazorpayClient,
} from "@shopify-clone/payments";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const storeService = new StoreService();
const orderService = new OrderService();

interface RouteContext {
  params: Promise<{ storeSlug: string; checkoutId: string }>;
}

function getRazorpayProvider(): RazorpayPaymentProvider {
  const keyId =
    process.env.RAZORPAY_KEY_ID?.trim() ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ||
    "rzp_test_placeholder";
  const keySecret =
    process.env.RAZORPAY_KEY_SECRET?.trim() ||
    "rzp_test_secret_placeholder";

  const client = new RazorpayClient({ keyId, keySecret });
  return new RazorpayPaymentProvider({ keyId, keySecret, client });
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, checkoutId } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }
    if (!checkoutId) {
      throw new ApiHttpError(400, "INVALID_CHECKOUT_ID", "Checkout ID is required");
    }
    validateUuid(checkoutId, "checkoutId");

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    const body = (await req.json()) as {
      paymentId?: string;
      attemptId?: string;
      razorpayPaymentId?: string;
      razorpayOrderId?: string;
      razorpaySignature?: string;
    };

    if (!body || typeof body !== "object") {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Request body is required");
    }

    if (!body.paymentId || typeof body.paymentId !== "string") {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "paymentId is required");
    }
    validateUuid(body.paymentId, "paymentId");

    if (!body.attemptId || typeof body.attemptId !== "string") {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "attemptId is required");
    }
    validateUuid(body.attemptId, "attemptId");

    if (!body.razorpayPaymentId || typeof body.razorpayPaymentId !== "string") {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "razorpayPaymentId is required");
    }
    if (!body.razorpayOrderId || typeof body.razorpayOrderId !== "string") {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "razorpayOrderId is required");
    }
    if (!body.razorpaySignature || typeof body.razorpaySignature !== "string") {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "razorpaySignature is required");
    }

    // 1. Authoritative verification via ProviderPaymentService
    const provider = getRazorpayProvider();
    const providerService = new ProviderPaymentService(provider);

    const result = await providerService.verifyAndProcessCallback(ctx.db, {
      storeId: store.id,
      paymentId: body.paymentId,
      attemptId: body.attemptId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpayOrderId: body.razorpayOrderId,
      razorpaySignature: body.razorpaySignature,
    });

    // 2. Resolve resulting order if payment is captured
    let order = null;
    if (result.payment.status === "CAPTURED") {
      order = await orderService.getOrderByCheckoutId(ctx.db, store.id, checkoutId);
    }

    return apiSuccess(
      {
        verified: result.payment.status === "CAPTURED",
        paymentStatus: result.payment.status,
        paymentId: result.payment.id,
        order: order
          ? {
              id: order.id,
              orderNumber: order.orderNumber,
              status: order.status,
              paymentStatus: order.paymentStatus,
              total: order.total,
              currency: order.currency,
            }
          : null,
      },
      { requestId, status: 200 },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
