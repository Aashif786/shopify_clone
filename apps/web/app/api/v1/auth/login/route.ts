import { login, serializeSessionCookie } from "@shopify-clone/auth";
import {
  apiSuccess,
  handleApiError,
  loginValidator,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";

export async function POST(req: Request) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const validated = await validateBody(req, loginValidator);
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
