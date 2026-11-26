import { StoreTypeService } from "@calcart/stores";
import {
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";
import { setStoreTypeValidator } from "@/lib/api/fit-check-validators";

const storeTypeService = new StoreTypeService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

/** Current classification, Fit Check status and the platform-managed list of types. */
export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;
    const auth = requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    await requireStoreOrNotFound(ctx, storeId);

    const classification = await storeTypeService.getStoreClassification(
      ctx.db,
      storeId,
      auth.user.id,
    );
    const availableTypes = await storeTypeService.listSelectableStoreTypes(ctx.db);

    return apiSuccess({ classification, availableTypes }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

/** Changes the store type. Disables Fit Check (after confirmation) for non-fashion types. */
export async function PATCH(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;
    const auth = requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    await requireStoreOrNotFound(ctx, storeId, "admin");

    const validated = await validateBody(req, setStoreTypeValidator);
    const result = await storeTypeService.setStoreType(
      ctx.db,
      storeId,
      auth.user.id,
      validated,
    );

    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
