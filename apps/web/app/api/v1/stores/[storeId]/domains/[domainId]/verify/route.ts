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
  params: Promise<{ storeId: string; domainId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId, domainId } = await Promise.resolve(context.params);

    await requireStoreOrNotFound(ctx, storeId);

    const result = await storeService.verifyCustomDomain(
      ctx.db,
      storeId,
      auth.user.id,
      domainId,
    );

    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
