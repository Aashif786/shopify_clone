import { CheckoutService } from "@calcart/checkout";
import { StoreService } from "@calcart/stores";
import { InventoryService } from "@calcart/inventory";
import { OrderService } from "@calcart/orders";
import {
  PaymentAttemptRepository,
  PaymentRepository,
} from "@calcart/db";
import {
  PaymentCheckoutCoordinator,
  PaymentOrderIntegration,
  ProviderPaymentService,
} from "@calcart/payments";
import {
  ApiHttpError,
  apiSuccess,
  extractIdempotencyKey,
  handleApiError,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";
import { enrichCheckout } from "@/lib/storefront-checkout-helpers";
import {
  assertCheckoutOwnership,
  extractGuestToken,
  resolveStorefrontCustomer,
} from "@/lib/storefront-auth-helpers";
import {
  getRazorpayProvider,
  tryGetRazorpayProvider,
} from "@/lib/payment-provider-helper";

const storeService = new StoreService();
const checkoutService = new CheckoutService();
const orderService = new OrderService();
const paymentCoordinator = new PaymentCheckoutCoordinator();
const paymentOrderIntegration = new PaymentOrderIntegration();
const inventoryService = new InventoryService();

interface RouteContext {
  params: Promise<{ storeSlug: string; checkoutId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
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

    const checkout = await checkoutService.getCheckout(ctx.db, store.id, checkoutId);
    if (!checkout || checkout.storeId !== store.id) {
      throw new ApiHttpError(404, "CHECKOUT_NOT_FOUND", "Checkout not found");
    }

    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const guestToken = extractGuestToken(req);
    assertCheckoutOwnership(checkout, { customer, guestToken });

    const paymentRepo = new PaymentRepository();
    const attemptRepo = new PaymentAttemptRepository();
    const activePayment = await paymentRepo.findActiveByCheckoutId(ctx.db, store.id, checkoutId);

    let status = "IDLE";
    let canRetry = true;
    let order: { id: string; orderNumber: string; status: string; paymentStatus: string } | null = null;

    if (checkout.status === "COMPLETED") {
      status = "CAPTURED";
      canRetry = false;
      const orderRow = await orderService.getOrderByCheckoutId(ctx.db, store.id, checkoutId);
      if (orderRow) {
        order = {
          id: orderRow.id,
          orderNumber: orderRow.orderNumber,
          status: orderRow.status,
          paymentStatus: orderRow.paymentStatus,
        };
      }
    } else if (activePayment) {
      if (activePayment.status === "PENDING" || activePayment.status === "REQUIRES_RECONCILIATION") {
        const provider = tryGetRazorpayProvider();
        if (provider) {
          const providerService = new ProviderPaymentService(provider);
          const recon = await providerService.reconcilePaymentWithGateway(ctx.db, store.id, activePayment.id);
          if (recon.payment.status === "CAPTURED") {
            status = "CAPTURED";
            canRetry = false;
            const orderDto = recon.order ?? (await orderService.getOrderByCheckoutId(ctx.db, store.id, checkoutId));
            if (orderDto) {
              order = {
                id: orderDto.id,
                orderNumber: orderDto.orderNumber,
                status: orderDto.status,
                paymentStatus: orderDto.paymentStatus,
              };
            }
          } else {
            status = recon.payment.status;
            canRetry = recon.payment.status === "FAILED";
          }
        } else {
          status = activePayment.status;
          canRetry = false;
        }
      } else if (activePayment.status === "CAPTURED") {
        status = "CAPTURED";
        canRetry = false;
        const orderRow = await orderService.getOrderByCheckoutId(ctx.db, store.id, checkoutId);
        if (orderRow) {
          order = {
            id: orderRow.id,
            orderNumber: orderRow.orderNumber,
            status: orderRow.status,
            paymentStatus: orderRow.paymentStatus,
          };
        }
      } else if (activePayment.status === "FAILED" || activePayment.status === "CANCELLED") {
        status = "FAILED";
        canRetry = true;
      }
    }

    const latestAttempt = activePayment
      ? (await attemptRepo.findByPaymentId(ctx.db, store.id, activePayment.id)).pop()
      : null;

    return apiSuccess(
      {
        status,
        canRetry,
        checkout: {
          id: checkout.id,
          status: checkout.status,
          total: checkout.total,
          currency: checkout.currency,
        },
        payment: activePayment
          ? {
              id: activePayment.id,
              status: activePayment.status,
              amount: Number(activePayment.amount),
              currency: activePayment.currency,
            }
          : null,
        attempt: latestAttempt
          ? {
              id: latestAttempt.id,
              status: latestAttempt.status,
              providerOrderId: latestAttempt.provider_order_id,
            }
          : null,
        order,
      },
      { requestId, timing: ctx.timing, status: 200 },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
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

    // 1. Fetch checkout and verify store association
    const checkout = await checkoutService.getCheckout(ctx.db, store.id, checkoutId);
    if (!checkout || checkout.storeId !== store.id) {
      throw new ApiHttpError(404, "CHECKOUT_NOT_FOUND", "Checkout not found");
    }

    // 2. Server-side authorization check: caller must own this checkout
    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const guestToken = extractGuestToken(req);
    assertCheckoutOwnership(checkout, { customer, guestToken });

    // 3. Early recovery: If checkout is already COMPLETED, return order details immediately
    if (checkout.status === "COMPLETED") {
      const existingOrder = await orderService.getOrderByCheckoutId(ctx.db, store.id, checkoutId);
      const enriched = await enrichCheckout(ctx.db, store.id, checkout);
      return apiSuccess(
        {
          alreadyCompleted: true,
          order: existingOrder
            ? {
                id: existingOrder.id,
                orderNumber: existingOrder.orderNumber,
                status: existingOrder.status,
                paymentStatus: existingOrder.paymentStatus,
              }
            : null,
          checkout: enriched,
          store: {
            id: store.id,
            name: store.name,
            slug: store.slug,
            currency: store.currency,
          },
        },
        { requestId, timing: ctx.timing, status: 200 },
      );
    }

    // 4. Early recovery: If active payment is already CAPTURED, complete workflow and return order
    const paymentRepo = new PaymentRepository();
    const activePayment = await paymentRepo.findActiveByCheckoutId(ctx.db, store.id, checkoutId);
    if (activePayment && activePayment.status === "CAPTURED") {
      const wf = await paymentOrderIntegration.completePurchaseWorkflow(ctx.db, {
        storeId: store.id,
        paymentId: activePayment.id,
      });
      const enriched = await enrichCheckout(ctx.db, store.id, wf.checkout);
      return apiSuccess(
        {
          alreadyCompleted: true,
          order: {
            id: wf.order.id,
            orderNumber: wf.order.orderNumber,
            status: wf.order.status,
            paymentStatus: wf.order.paymentStatus,
          },
          checkout: enriched,
          store: {
            id: store.id,
            name: store.name,
            slug: store.slug,
            currency: store.currency,
          },
        },
        { requestId, timing: ctx.timing, status: 200 },
      );
    }

    // 5. Verify checkout is in a payable state
    const nonRetryableStatuses = ["CANCELLED", "EXPIRED", "FAILED"];
    if (nonRetryableStatuses.includes(checkout.status)) {
      throw new ApiHttpError(
        400,
        "CHECKOUT_IMMUTABLE",
        `Cannot initiate payment for a checkout in '${checkout.status}' status`,
      );
    }
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

    // 6. Reserve stock for checkout items (prevents overselling)
    await inventoryService.reserveMany(ctx.db, store.id, {
      referenceType: "checkout",
      referenceId: checkout.id,
      items: checkout.items.map((it) => ({
        variantId: it.variantId,
        quantity: it.quantity,
      })),
    });

    // 7. Initialize Payment and Attempt
    const initResult = await paymentCoordinator.initializePaymentForCheckout(ctx.db, {
      storeId: store.id,
      checkoutId,
      idempotencyKey: idempotencyKey ?? undefined,
      provider: "RAZORPAY",
    });

    // 8. Create Gateway Order via authoritative Razorpay Provider (fail-closed if unconfigured)
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

    if (rzpOrder.alreadyCaptured) {
      let orderDto = null;
      if (rzpOrder.orderId) {
        orderDto = await orderService.getOrderById(ctx.db, store.id, rzpOrder.orderId);
      }
      return apiSuccess(
        {
          alreadyCompleted: true,
          order: orderDto
            ? {
                id: orderDto.id,
                orderNumber: orderDto.orderNumber,
                status: orderDto.status,
                paymentStatus: orderDto.paymentStatus,
              }
            : null,
          checkout: enriched,
          store: {
            id: store.id,
            name: store.name,
            slug: store.slug,
            currency: store.currency,
          },
        },
        { requestId, timing: ctx.timing, status: 200 },
      );
    }

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
      { requestId, timing: ctx.timing, status: 200 },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
