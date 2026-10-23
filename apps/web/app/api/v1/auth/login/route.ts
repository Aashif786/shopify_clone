import { login, serializeSessionCookie } from "@shopify-clone/auth";
import {
  apiSuccess,
  handleApiError,
  loginValidator,
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

    const ip = getClientIp(req);
    const ipRateLimit = enforceRateLimit(
      `auth:login:ip:${ip}`,
      AUTH_RATE_LIMIT.limit,
      AUTH_RATE_LIMIT.windowMs,
      requestId,
    );
    if (ipRateLimit) {
      return ipRateLimit;
    }

    const validated = await validateBody(req, loginValidator);
    const normalizedEmail = validated.email.trim().toLowerCase();
    const accountRateLimit = enforceRateLimit(
      `auth:login:account:${normalizedEmail}`,
      AUTH_RATE_LIMIT.limit,
      AUTH_RATE_LIMIT.windowMs,
      requestId,
    );
    if (accountRateLimit) {
      return accountRateLimit;
    }

    const result = await login(ctx.db, validated);

    const sessionCookie = serializeSessionCookie(result.session.id, {
      expires: result.session.expiresAt,
    });

    const headers = new Headers();
    headers.set("Set-Cookie", sessionCookie);

    return apiSuccess(
      {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          status: result.user.status,
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
