import {
  logout,
  serializeExpiredSessionCookie,
} from "@shopify-clone/auth";
import {
  apiSuccess,
  handleApiError,
  requireAuth,
  resolveRequestContext,
} from "@/lib/api";

export async function POST(req: Request) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    await logout(ctx.db, auth.session.id);

    const expiredCookie = serializeExpiredSessionCookie();
    const headers = new Headers();
    headers.set("Set-Cookie", expiredCookie);

    return apiSuccess(
      {
        message: "Successfully logged out",
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
