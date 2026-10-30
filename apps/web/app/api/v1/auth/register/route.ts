import { register, serializeSessionCookie } from "@calcart/auth";
import { getEmailService } from "@calcart/email";
import {
  apiSuccess,
  handleApiError,
  registerValidator,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";

export async function POST(req: Request) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const validated = await validateBody(req, registerValidator);
    const result = await register(ctx.db, validated);

    try {
      const emailService = getEmailService();
      await emailService.sendMerchantWelcome({
        to: result.user.email,
        name: result.user.name,
      });
    } catch (emailErr) {
      console.error("[Auth:MerchantRegister] Welcome email delivery failed:", emailErr);
    }

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
        status: 201,
        headers,
        requestId,
      }
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
