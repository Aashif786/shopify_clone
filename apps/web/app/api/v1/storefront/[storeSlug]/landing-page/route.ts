import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
} from "@/lib/api";

const storeService = new StoreService();

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }

    const data = await storeService.getPublishedLandingPageBySlug(ctx.db, storeSlug);

    return apiSuccess(
      {
        store: data.store,
        config: data.config,
        publishedAt: data.publishedAt,
      },
      { requestId },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
