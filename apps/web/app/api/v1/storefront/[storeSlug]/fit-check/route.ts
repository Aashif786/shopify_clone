import { StoreService, StoreTypeService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
} from "@/lib/api";

const storeService = new StoreService();
const storeTypeService = new StoreTypeService();

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

/** Public: whether Fit Check is available on this storefront. Exposes a boolean only. */
export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug } = await Promise.resolve(context.params);
    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(404, "STORE_NOT_FOUND", "Store not found");
    }

    const active = await storeTypeService.isFitCheckActive(ctx.db, store.id);
    return apiSuccess({ active }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
