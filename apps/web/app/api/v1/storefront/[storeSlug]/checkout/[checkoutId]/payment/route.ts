import { CheckoutService } from "@shopify-clone/checkout";
import { StoreService } from "@shopify-clone/stores";
import {
  PaymentCheckoutCoordinator,
  ProviderPaymentService,
  RazorpayPaymentProvider,
  RazorpayClient,
} from "@shopify-clone/payments";
import {
  ApiHttpError,
  apiSuccess,
  extractIdempotencyKey,
  handleApiError,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";
import { enrichCheckout } from "@/lib/storefront-checkout-helpers";

const storeService = new StoreService();
const checkoutService = new CheckoutService();
const paymentCoordinator = new PaymentCheckoutCoordinator();

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

    // 1. Verify checkout state before initializing payment
    const checkout = await checkoutService.getCheckout(ctx.db, store.id, checkoutId);
    if (!checkout.email) {
      throw new ApiHttpError(
        400,
        "CUSTOMER_EMAIL_REQUIRED",
        "Customer email is required before initiating payment",
      );
    }
    if (!checkout.shippingAddress) {
      throw new ApiHttpError(
        400,
        "SHIPPING_ADDRESS_REQUIRED",
        "Shipping address is required before initiating payment",
      );
    }
    if (checkout.items.length === 0) {
      throw new ApiHttpError(
        400,
        "EMPTY_CHECKOUT",
        "Cannot initiate payment for a checkout with no items",
      );
    }

    const idempotencyKey = extractIdempotencyKey(req);

    // 2. Initialize Payment and Attempt
    const initResult = await paymentCoordinator.initializePaymentForCheckout(ctx.db, {
      storeId: store.id,
      checkoutId,
      idempotencyKey: idempotencyKey ?? undefined,
      provider: "RAZORPAY",
    });

    // 3. Create Gateway Order via Razorpay Provider
    const provider = getRazorpayProvider();
    const providerService = new ProviderPaymentService(provider);

    const rzpOrder = await providerService.createProviderOrder(
      ctx.db,
      store.id,
      initResult.payment.id,
      initResult.attempt.id,
    );

    const currentCheckout = await checkoutService.getCheckout(ctx.db, store.id, checkoutId);
    const enriched = await enrichCheckout(ctx.db, store.id, currentCheckout);

    return apiSuccess(
      {
        payment: initResult.payment,
        attempt: initResult.attempt,
        razorpayOrder: {
          providerOrderId: rzpOrder.providerOrderId,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency,
          razorpayKeyId: rzpOrder.razorpayKeyId,
          paymentId: initResult.payment.id,
          attemptId: initResult.attempt.id,
        },
        checkout: enriched,
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          currency: store.currency,
        },
      },
      { requestId, status: 200 },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
