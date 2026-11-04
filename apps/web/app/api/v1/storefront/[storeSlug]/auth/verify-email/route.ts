import { consumeEmailVerificationToken } from "@calcart/auth";
import { CustomerService } from "@calcart/customers";
import { StoreService } from "@calcart/stores";
import {
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateBody,
  verifyEmailValidator,
} from "@/lib/api";
import {
  AUTH_RATE_LIMIT,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limiter";

const storeService = new StoreService();
const customerService = new CustomerService();

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const rateLimit = enforceRateLimit(
      `storefront:auth:verify-email:ip:${getClientIp(req)}`,
      AUTH_RATE_LIMIT.limit,
      AUTH_RATE_LIMIT.windowMs,
      requestId,
    );
    if (rateLimit) {
      return rateLimit;
    }

    const { storeSlug } = await Promise.resolve(context.params);
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);

    const body = await validateBody(req, verifyEmailValidator);
    const verified = await consumeEmailVerificationToken(ctx.db, body.token, store.id);

    await customerService.resolveStoreCustomerForUser(ctx.db, store.id, {
      userId: verified.userId,
      email: verified.email,
      emailVerified: true,
    });

    return apiSuccess({ status: "verified" }, { status: 200, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
