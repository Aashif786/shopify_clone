import { resetPasswordWithToken } from "@calcart/auth";
import { getEmailService } from "@calcart/email";
import {
  apiSuccess,
  handleApiError,
  resetPasswordValidator,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";

export async function POST(req: Request) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const validated = await validateBody(req, resetPasswordValidator);
    const user = await resetPasswordWithToken(ctx.db, validated.token, validated.newPassword);

    try {
      const emailService = getEmailService();
      await emailService.sendPasswordChangedNotification({
        to: user.email,
        name: user.name,
        changedAt: new Date(),
      });
    } catch (emailErr) {
      console.error("[Auth:ResetPassword] Notification delivery failed:", emailErr);
    }

    return apiSuccess(
      {
        message: "Password has been successfully reset. Please log in with your new password.",
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
