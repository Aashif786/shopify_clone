import { CheckoutService } from "@calcart/checkout";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  extractIdempotencyKey,
  handleApiError,
  resolveRequestContext,
  validateBody,
  createCheckoutValidator,
} from "@/lib/api";
import { enrichCheckout } from "@/lib/storefront-checkout-helpers";
import {
  extractGuestIdentifier,
  extractGuestToken,
  generateSecureToken,
  hashToken,
  resolveStorefrontCustomer,
} from "@/lib/storefront-auth-helpers";

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

    const validated = await validateBody(req, createCheckoutValidator);

    const idempotencyKey = extractIdempotencyKey(req);
    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const guestIdentifier =
      extractGuestIdentifier(req) ||
      (typeof validated.guestIdentifier === "string" && validated.guestIdentifier.trim()
        ? validated.guestIdentifier.trim()
        : null);

    // Caller context for cart ownership validation in checkoutService
    const caller = {
      customerId: customer?.id,
      guestIdentifier,
    };

    // For guest checkouts, reuse client-supplied guest token or generate a cryptographically secure token
    let guestToken: string | undefined;
    let guestTokenHash: string | undefined;
    if (!customer) {
      guestToken = extractGuestToken(req) || undefined;
      if (!guestToken) {
        guestToken = generateSecureToken();
      }
      guestTokenHash = hashToken(guestToken);
    }

    const checkout = await checkoutService.createCheckoutFromCart(
      ctx.db,
      store.id,
      validated.cartId,
      {
        customerId: customer?.id ?? null,
        email: validated.email ?? customer?.email ?? null,
        idempotencyKey: idempotencyKey ?? undefined,
        guestTokenHash,
        caller,
      },
    );

    const enriched = await enrichCheckout(ctx.db, store.id, checkout);

    const headers: Record<string, string> = {};
    if (guestToken) {
      headers["x-guest-token"] = guestToken;
      headers["Set-Cookie"] = `sc_${storeSlug}_guest_token=${encodeURIComponent(guestToken)}; Path=/; SameSite=Lax`;
    }

    return apiSuccess(
      {
        checkout: {
          ...enriched,
          guestToken,
        },
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          currency: store.currency,
        },
      },
      { requestId, status: 201, headers },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
