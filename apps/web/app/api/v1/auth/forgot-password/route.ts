import { createPasswordResetToken } from "@shopify-clone/auth";
import { getEmailService } from "@shopify-clone/email";
import {
  apiSuccess,
  forgotPasswordValidator,
  handleApiError,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";

export async function POST(req: Request) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const validated = await validateBody(req, forgotPasswordValidator);
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
