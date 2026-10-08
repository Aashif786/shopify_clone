import {
  apiSuccess,
  handleApiError,
  requireAuth,
  resolveRequestContext,
} from "@/lib/api";

export async function GET(req: Request) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);

    return apiSuccess(
      {
        user: {
          id: auth.user.id,
          email: auth.user.email,
          name: auth.user.name,
          status: auth.user.status,
        },
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
