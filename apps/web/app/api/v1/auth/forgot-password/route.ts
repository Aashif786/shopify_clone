import { createPasswordResetToken } from "@calcart/auth";
import { getEmailService } from "@calcart/email";
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

export async function POST(req: Request) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const ipLimit = enforceRateLimit(
      `auth:forgot-password:ip:${getClientIp(req)}`,
      AUTH_RATE_LIMIT.limit,
      AUTH_RATE_LIMIT.windowMs,
      requestId,
    );
    if (ipLimit) {
      return ipLimit;
    }

    const validated = await validateBody(req, forgotPasswordValidator);
    const emailLimit = enforceRateLimit(
      `auth:forgot-password:account:${validated.email.trim().toLowerCase()}`,
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
        const emailService = getEmailService();
        await emailService.sendMerchantPasswordReset({
          to: validated.email,
          token,
        });
      } catch (emailErr) {
        // Operational log: ensure delivery failures do not expose tokens or break the response
        console.error("[Auth:MerchantForgotPassword] Email delivery failed:", emailErr);
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
