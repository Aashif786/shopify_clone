import { register, serializeSessionCookie } from "@calcart/auth";
import { StoreService } from "@calcart/stores";
import { getEmailService } from "@calcart/email";
import {
  acceptInvitationValidator,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";

const storeService = new StoreService();

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { token } = await Promise.resolve(context.params);
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
    const details = await storeService.getInvitationDetails(ctx.db, token);

    let activeUserId: string;
    let sessionCookie: string | undefined;

    if (ctx.auth) {
      activeUserId = ctx.auth.user.id;
    } else {
      const body = await validateBody(req, acceptInvitationValidator);
      if (!body.password) {
        throw new Error("Password is required to create an account for this invitation");
      }
      const name = body.name || details.email.split("@")[0] || "Staff Member";

      const regResult = await register(ctx.db, {
        email: details.email,
        password: body.password,
        name,
      });

      activeUserId = regResult.user.id;
      sessionCookie = serializeSessionCookie(regResult.session.id, {
        expires: regResult.session.expiresAt,
      });
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
