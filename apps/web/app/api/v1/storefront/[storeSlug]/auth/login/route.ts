import {
  isUserEmailVerified,
  login,
  serializeCustomerSessionCookie,
} from "@calcart/auth";
import { CustomerService } from "@calcart/customers";
import { CartService } from "@calcart/carts";
import { StoreService } from "@calcart/stores";
import {
  apiSuccess,
  handleApiError,
  loginValidator,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";
import { extractGuestIdentifier } from "@/lib/storefront-auth-helpers";
import {
  AUTH_RATE_LIMIT,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limiter";

const storeService = new StoreService();
const customerService = new CustomerService();
const cartService = new CartService();

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const ip = getClientIp(req);
    const rateLimitRes = enforceRateLimit(
      `storefront:auth:login:${ip}`,
      AUTH_RATE_LIMIT.limit,
      AUTH_RATE_LIMIT.windowMs,
      requestId,
    );
    if (rateLimitRes) {
      return rateLimitRes;
    }

    const { storeSlug } = await Promise.resolve(context.params);
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);

    const validated = await validateBody(req, loginValidator);
    const normalizedEmail = validated.email.trim().toLowerCase();
    const accountRateLimit = enforceRateLimit(
      `storefront:auth:login:account:${store.id}:${normalizedEmail}`,
      AUTH_RATE_LIMIT.limit,
      AUTH_RATE_LIMIT.windowMs,
      requestId,
    );
    if (accountRateLimit) {
      return accountRateLimit;
    }

    const authResult = await login(ctx.db, validated);
    const emailVerified = await isUserEmailVerified(ctx.db, authResult.user.id);
    const [firstName, ...restName] = authResult.user.name.split(" ");
    const customer = await customerService.resolveStoreCustomerForUser(ctx.db, store.id, {
      userId: authResult.user.id,
      email: authResult.user.email,
      firstName: firstName || authResult.user.name,
      lastName: restName.join(" ") || undefined,
      emailVerified,
    });

    const storeSessionCookie = serializeCustomerSessionCookie(
      authResult.session.id,
      storeSlug,
      { expires: authResult.session.expiresAt }
    );
    const genericCustomerCookie = serializeCustomerSessionCookie(
      authResult.session.id,
      undefined,
      { expires: authResult.session.expiresAt }
    );

    // Merge guest cart if caller has an active guest session
    const guestIdentifier = extractGuestIdentifier(req);
    if (guestIdentifier && customer) {
      try {
        await cartService.mergeCart(ctx.db, store.id, guestIdentifier, customer.id);
      } catch {
        // Proceed with login even if cart merge fails or has no items
      }
    }

    const headers = new Headers();
    headers.append("Set-Cookie", storeSessionCookie);
    headers.append("Set-Cookie", genericCustomerCookie);

    return apiSuccess(
      {
        customer,
        user: {
          id: authResult.user.id,
          email: authResult.user.email,
          name: authResult.user.name,
        },
      },
      {
        status: 200,
        headers,
        requestId,
      }
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
