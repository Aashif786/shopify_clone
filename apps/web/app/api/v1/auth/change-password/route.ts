import { changePassword, createSession, serializeSessionCookie } from "@calcart/auth";
import { getEmailService } from "@calcart/email";
import {
  apiSuccess,
  changePasswordValidator,
  handleApiError,
  requireAuth,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";

export async function POST(req: Request) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const validated = await validateBody(req, changePasswordValidator);

    await changePassword(
      ctx.db,
      auth.user.id,
      validated.currentPassword,
      validated.newPassword
    );

    try {
      const emailService = getEmailService();
      await emailService.sendPasswordChangedNotification({
        to: auth.user.email,
        name: auth.user.name,
        changedAt: new Date(),
      });
    } catch (emailErr) {
      console.error("[Auth:ChangePassword] Notification delivery failed:", emailErr);
    }

    const newSession = await createSession(ctx.db, auth.user.id);
    const sessionCookie = serializeSessionCookie(
      newSession.token ?? newSession.id,
      {
        expires: newSession.expiresAt,
      }
    );

    const headers = new Headers();
    headers.set("Set-Cookie", sessionCookie);

    return apiSuccess(
      {
        message: "Password has been successfully changed. All other sessions have been revoked.",
      },
      {
        status: 200,
        requestId,
        headers,
      }
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
