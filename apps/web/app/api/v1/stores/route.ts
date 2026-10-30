import { StoreService } from "@calcart/stores";
import {
  apiSuccess,
  createStoreValidator,
  handleApiError,
  requireAuth,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";

const storeService = new StoreService();

export async function POST(req: Request) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const validated = await validateBody(req, createStoreValidator);
    const store = await storeService.createStore(
      ctx.db,
      auth.user.id,
      validated,
    );

    return apiSuccess(store, {
      status: 201,
      requestId,
    });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function GET(req: Request) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const stores = await storeService.listUserStores(ctx.db, auth.user.id);

    return apiSuccess({ items: stores }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
