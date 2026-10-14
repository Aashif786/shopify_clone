import {
  apiSuccess,
  handleApiError,
  requireAuth,
  resolveRequestContext,
  updateProfileValidator,
  validateBody,
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

export async function PATCH(req: Request) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const validated = await validateBody(req, updateProfileValidator);

    const { updateUserProfile } = await import("@shopify-clone/auth");
    const updated = await updateUserProfile(ctx.db, auth.user.id, validated);

    return apiSuccess(
      {
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          status: updated.status,
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
