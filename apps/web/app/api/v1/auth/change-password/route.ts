import { changePassword } from "@shopify-clone/auth";
import { getEmailService } from "@shopify-clone/email";
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

    return apiSuccess(
      {
        message: "Password has been successfully changed. All other sessions have been revoked.",
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
