import {
  apiError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
} from "@/lib/api";

export async function GET(req: Request) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const health = await ctx.db.healthCheck();
    if (!health.ok) {
      return apiError(
        "DATABASE_UNAVAILABLE",
        "Database connectivity check failed",
        503,
        { requestId }
      );
    }

    return apiSuccess(
      {
        status: "healthy",
        database: "healthy",
        timestamp: new Date().toISOString(),
      },
      { requestId }
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
