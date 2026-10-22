import { login, serializeSessionCookie } from "@shopify-clone/auth";
import { CustomerService } from "@shopify-clone/customers";
import { CartService } from "@shopify-clone/carts";
import { StoreService } from "@shopify-clone/stores";
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
    const authResult = await login(ctx.db, validated);

    // Resolve customer record in this specific store
    let customer = await customerService.getCustomerByUserId(
      ctx.db,
      store.id,
      authResult.user.id
    );

    if (!customer) {
      // Check if a customer record with this email exists (e.g. from guest checkout)
      const existingEmailCustomer = await customerService.getCustomerByEmail(
        ctx.db,
        store.id,
        authResult.user.email
      );

      if (existingEmailCustomer) {
        customer = await customerService.updateCustomer(
          ctx.db,
          store.id,
          existingEmailCustomer.id,
          {
            userId: authResult.user.id,
          }
        );
      } else {
        // Auto-provision customer for this store
        customer = await customerService.createCustomer(ctx.db, store.id, {
          email: authResult.user.email,
          firstName: authResult.user.name.split(" ")[0] || authResult.user.name,
          lastName: authResult.user.name.split(" ").slice(1).join(" ") || undefined,
          userId: authResult.user.id,
        });
      }
    }

    const sessionCookie = serializeSessionCookie(authResult.session.id, {
      expires: authResult.session.expiresAt,
    });

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
    headers.set("Set-Cookie", sessionCookie);

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
