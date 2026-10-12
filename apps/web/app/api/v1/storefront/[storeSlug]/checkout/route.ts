import { CheckoutService } from "@shopify-clone/checkout";
import { StoreService } from "@shopify-clone/stores";
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

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available",
      );
    }

    const body = (await req.json()) as {
      cartId?: string;
      email?: string;
      customerId?: string;
    };

    if (!body || typeof body !== "object") {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Request body is required");
    }

    if (!body.cartId || typeof body.cartId !== "string") {
      throw new ApiHttpError(
        400,
        "VALIDATION_ERROR",
        "cartId is required to start checkout",
        { fields: { cartId: "Cart ID is required" } },
      );
    }
    validateUuid(body.cartId, "cartId");

    const idempotencyKey = extractIdempotencyKey(req);
    const customerId = ctx.auth?.user?.id ?? body.customerId ?? null;

    const checkout = await checkoutService.createCheckoutFromCart(
      ctx.db,
      store.id,
      body.cartId,
      {
        customerId,
        email: body.email ?? null,
        idempotencyKey: idempotencyKey ?? undefined,
      },
    );

    const enriched = await enrichCheckout(ctx.db, store.id, checkout);

    return apiSuccess(
      {
        checkout: enriched,
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          currency: store.currency,
        },
      },
      { requestId, status: 201 },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
