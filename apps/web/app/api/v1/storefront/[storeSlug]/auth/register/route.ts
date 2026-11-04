import {
  createEmailVerificationToken,
  hashPassword,
  register,
  revokeSession,
  UserAlreadyExistsError,
} from "@calcart/auth";
import { CustomerService } from "@calcart/customers";
import { StoreService } from "@calcart/stores";
import { getEmailService } from "@calcart/email";
import {
  apiSuccess,
  customerRegisterValidator,
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
      `storefront:auth:register:ip:${getClientIp(req)}`,
      AUTH_RATE_LIMIT.limit,
      AUTH_RATE_LIMIT.windowMs,
      requestId,
    );
    if (ipLimit) {
      return ipLimit;
    }

    const { storeSlug } = await Promise.resolve(context.params);
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);

    const body = await validateBody(req, customerRegisterValidator);
    const normalizedEmail = body.email.trim().toLowerCase();
    const emailLimit = enforceRateLimit(
      `storefront:auth:register:account:${store.id}:${normalizedEmail}`,
      AUTH_RATE_LIMIT.limit,
      AUTH_RATE_LIMIT.windowMs,
      requestId,
    );
    if (emailLimit) {
      return emailLimit;
    }

    const fullName =
      [body.firstName, body.lastName].filter(Boolean).join(" ").trim() ||
      normalizedEmail.split("@")[0] ||
      "Customer";

    try {
      const authResult = await register(ctx.db, {
        email: body.email,
        password: body.password,
        name: fullName,
      });
      await revokeSession(ctx.db, authResult.session.id);

      await customerService.resolveStoreCustomerForUser(ctx.db, store.id, {
        userId: authResult.user.id,
        email: authResult.user.email,
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        emailVerified: false,
      });

      const token = await createEmailVerificationToken(ctx.db, authResult.user.id, store.id);
      try {
        const emailService = getEmailService();
        await emailService.sendCustomerEmailVerification({
          to: authResult.user.email,
          token,
          storeName: store.name,
          storeSlug,
          customerName: body.firstName,
        });
        await emailService.sendCustomerWelcome({
          to: authResult.user.email,
          storeName: store.name,
          storeSlug,
          customerName: body.firstName,
        });
      } catch (emailErr) {
        console.error("[Customer:Register] Account email delivery failed:", emailErr);
      }
    } catch (err) {
      if (err instanceof UserAlreadyExistsError) {
        await hashPassword(body.password);
      } else {
        throw err;
      }
    }

    return apiSuccess({ status: "accepted" }, { status: 201, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
