import { StoreService } from "@shopify-clone/stores";
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

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);

    await requireStoreOrNotFound(ctx, storeId);
    const domainsData = await storeService.getStoreDomains(
      ctx.db,
      storeId,
      auth.user.id,
    );

    return apiSuccess(domainsData, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
