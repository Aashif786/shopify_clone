import { StoreService } from "@shopify-clone/stores";
import { OrderService } from "@shopify-clone/orders";
import { CheckoutService } from "@shopify-clone/checkout";
import { ProviderPaymentService } from "@shopify-clone/payments";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  type RequestContext,
  validateUuid,
  validateBody,
  verifyPaymentValidator,
} from "@/lib/api";
import {
  assertCheckoutOwnership,
  extractGuestToken,
  resolveStorefrontCustomer,
} from "@/lib/storefront-auth-helpers";
import { getRazorpayProvider } from "@/lib/payment-provider-helper";
import {
  PAYMENT_VERIFY_RATE_LIMIT,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limiter";

const storeService = new StoreService();
const orderService = new OrderService();
const checkoutService = new CheckoutService();

interface RouteContext {
  params: Promise<{ storeSlug: string; checkoutId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  let ctx: RequestContext | undefined;
  try {
    ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug, checkoutId } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }
    if (!checkoutId) {
      throw new ApiHttpError(400, "INVALID_CHECKOUT_ID", "Checkout ID is required");
    }
    validateUuid(checkoutId, "checkoutId");

    // Protect verification endpoint from brute-force floods across multiple checkouts
    const ip = getClientIp(req);
    const ipRateLimit = enforceRateLimit(
      `payment:verify:ip:${ip}`,
      30,
      60_000,
      requestId,
    );
    if (ipRateLimit) {
      return ipRateLimit;
    }

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    // 1. Fetch checkout and verify store association
    const checkout = await checkoutService.getCheckout(ctx.db, store.id, checkoutId);
    if (!checkout || checkout.storeId !== store.id) {
      throw new ApiHttpError(404, "CHECKOUT_NOT_FOUND", "Checkout not found");
    }

    // 2. Server-side authorization check: caller must own this checkout
    // This MUST precede checkout-specific rate limiting so unauthorized callers
    // cannot consume another customer's rate-limit budget!
    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const guestToken = extractGuestToken(req);
    assertCheckoutOwnership(checkout, { customer, guestToken });

    // 3. Verify checkout is not in terminal/cancelled/expired status
    if (checkout.status === "CANCELLED" || checkout.status === "EXPIRED" || checkout.status === "FAILED") {
      throw new ApiHttpError(
        400,
        "CHECKOUT_IMMUTABLE",
        `Cannot verify payment because checkout is in '${checkout.status}' status`,
      );
    }

    // 4. Enforce checkout-specific rate limit (only for authorized owner)
    const checkoutRateLimit = enforceRateLimit(
      `checkout:payment:verify:${checkoutId}`,
      PAYMENT_VERIFY_RATE_LIMIT.limit,
      PAYMENT_VERIFY_RATE_LIMIT.windowMs,
      requestId,
    );
    if (checkoutRateLimit) {
      return checkoutRateLimit;
    }

    // 4. Validate request body with size limits and schema validation
    const validated = await validateBody(req, verifyPaymentValidator);

    // 4. Authoritative verification via ProviderPaymentService using configured RAZORPAY_KEY_SECRET
    // And validate that the payment record is strictly bound to this checkoutId
    const provider = getRazorpayProvider();
    const providerService = new ProviderPaymentService(provider);

    const result = await providerService.verifyAndProcessCallback(ctx.db, {
      storeId: store.id,
      checkoutId: checkout.id,
      paymentId: validated.paymentId,
      attemptId: validated.attemptId,
      razorpayPaymentId: validated.razorpayPaymentId,
      razorpayOrderId: validated.razorpayOrderId,
      razorpaySignature: validated.razorpaySignature,
    });

    // 5. Resolve resulting order if payment is captured
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
      { requestId, timing: ctx.timing, status: 200 },
    );
  } catch (error) {
    return handleApiError(error, requestId, ctx?.timing);
  }
}
