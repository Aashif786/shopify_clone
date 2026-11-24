import { hashToken, register, serializeSessionCookie } from "@calcart/auth";
import { StoreService } from "@calcart/stores";
import { getEmailService } from "@calcart/email";
import {
  acceptInvitationValidator,
  apiSuccess,
  ApiHttpError,
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

function limitInvitationAttempt(
  req: Request,
  token: string,
  requestId: string | undefined,
) {
  const ipLimit = enforceRateLimit(
    `auth:invitation:ip:${getClientIp(req)}`,
    AUTH_RATE_LIMIT.limit,
    AUTH_RATE_LIMIT.windowMs,
    requestId,
  );
  if (ipLimit) {
    return ipLimit;
  }
  return enforceRateLimit(
    `auth:invitation:token:${hashToken(token)}`,
    AUTH_RATE_LIMIT.limit,
    AUTH_RATE_LIMIT.windowMs,
    requestId,
  );
}

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { token } = await Promise.resolve(context.params);
    const limited = limitInvitationAttempt(req, token, requestId);
    if (limited) {
      return limited;
    }
    const details = await storeService.getInvitationDetails(ctx.db, token);

    return apiSuccess({ invitation: details }, { status: 200, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { token } = await Promise.resolve(context.params);
    const limited = limitInvitationAttempt(req, token, requestId);
    if (limited) {
      return limited;
    }
    const details = await storeService.getInvitationDetails(ctx.db, token);

    let activeUserId: string;
    let sessionCookie: string | undefined;

    if (ctx.auth) {
      if (
        ctx.auth.user.email.trim().toLowerCase() !==
        details.email.trim().toLowerCase()
      ) {
        throw new ApiHttpError(
          403,
          "INVITATION_EMAIL_MISMATCH",
          "Authenticated user email does not match invitation recipient"
        );
      }
      activeUserId = ctx.auth.user.id;
    } else {
      const body = await validateBody(req, acceptInvitationValidator);
      if (!body.password) {
        throw new ApiHttpError(
          400,
          "VALIDATION_ERROR",
          "Password is required to create an account for this invitation"
        );
      }
      const name = body.name || details.email.split("@")[0] || "Staff Member";

      const regResult = await register(ctx.db, {
        email: details.email,
        password: body.password,
        name,
      });

      activeUserId = regResult.user.id;
      sessionCookie = serializeSessionCookie(
        regResult.session.token ?? regResult.session.id,
        {
          expires: regResult.session.expiresAt,
        }
      );
    }

    const member = await storeService.acceptStoreInvitation(
      ctx.db,
      token,
      activeUserId
    );

    try {
      const emailService = getEmailService();
      await emailService.sendStaffInvitationAccepted({
        to: details.email,
        storeName: details.storeName,
        role: member.role,
      });
    } catch (emailErr) {
      console.error("[Invitations:Accept] Acceptance email delivery failed:", emailErr);
    }

    const headers = new Headers();
    if (sessionCookie) {
      headers.set("Set-Cookie", sessionCookie);
    }

    return apiSuccess(
      {
        member,
        storeId: details.storeId,
        storeSlug: details.storeSlug,
        storeName: details.storeName,
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
