import { StoreService } from "@calcart/stores";
import {
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
} from "@/lib/api";

const storeService = new StoreService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);

    await requireStoreOrNotFound(ctx, storeId, "admin");

    let configToPublish = undefined;
    try {
      const text = await req.text();
      if (text && text.trim()) {
        const body = JSON.parse(text);
        if (body.config) {
          configToPublish = body.config;
        }
      }
    } catch {
      // Empty or invalid body is allowed; defaults to current saved draft
    }

    const updated = await storeService.publishLandingPage(
      ctx.db,
      storeId,
      auth.user.id,
      configToPublish,
    );

    return apiSuccess(updated, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
