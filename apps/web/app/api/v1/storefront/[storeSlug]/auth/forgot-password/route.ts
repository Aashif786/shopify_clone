import { createPasswordResetToken } from "@calcart/auth";
import { getEmailService } from "@calcart/email";
import { StoreService } from "@calcart/stores";
import { CustomerService } from "@calcart/customers";
import {
  apiSuccess,
  forgotPasswordValidator,
  handleApiError,
  resolveRequestContext,
  validateBody,
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

    const ipLimit = enforceRateLimit(
      `storefront:auth:forgot-password:ip:${getClientIp(req)}`,
      AUTH_RATE_LIMIT.limit,
      AUTH_RATE_LIMIT.windowMs,
      requestId,
    );
    if (ipLimit) {
      return ipLimit;
    }

    const { storeSlug } = await Promise.resolve(context.params);
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);

    const validated = await validateBody(req, forgotPasswordValidator);
    const emailLimit = enforceRateLimit(
      `storefront:auth:forgot-password:account:${store.id}:${validated.email.trim().toLowerCase()}`,
      AUTH_RATE_LIMIT.limit,
      AUTH_RATE_LIMIT.windowMs,
      requestId,
    );
    if (emailLimit) {
      return emailLimit;
    }

    const token = await createPasswordResetToken(ctx.db, validated.email);

    if (token) {
      try {
        const customer = await customerService.getCustomerByEmail(
          ctx.db,
          store.id,
          validated.email
        );

        const emailService = getEmailService();
        await emailService.sendStorefrontPasswordReset({
          to: validated.email,
          token,
          storeName: store.name,
          storeSlug,
          customerName: customer?.firstName || undefined,
        });
      } catch (emailErr) {
        console.error("[Auth:StorefrontForgotPassword] Email delivery failed:", emailErr);
      }
    }

    return apiSuccess(
      {
        message: "If an account exists with that email, password reset instructions have been sent.",
      },
      {
        status: 200,
        requestId,
      }
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
