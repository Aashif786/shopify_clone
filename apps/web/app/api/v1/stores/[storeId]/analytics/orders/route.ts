import { AnalyticsService } from "@shopify-clone/orders";
import {
  analyticsQueryValidator,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateQuery,
  validateUuid,
} from "@/lib/api";

const analyticsService = new AnalyticsService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    await requireStoreOrNotFound(ctx, storeId, "staff");
    const query = validateQuery(req, analyticsQueryValidator);

    const result = await analyticsService.getOrderAnalytics(
      ctx.db,
      storeId,
      query,
    );
    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
