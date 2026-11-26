import { StoreTypeService } from "@calcart/stores";
import {
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";
import { setFitCheckEnabledValidator } from "@/lib/api/fit-check-validators";

const storeTypeService = new StoreTypeService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

/** Explicitly enables or disables Fit Check. Eligibility is enforced by the service. */
export async function PATCH(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;
    const auth = requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    await requireStoreOrNotFound(ctx, storeId, "admin");

    const { enabled } = await validateBody(req, setFitCheckEnabledValidator);
    const classification = await storeTypeService.setFitCheckEnabled(
      ctx.db,
      storeId,
      auth.user.id,
      enabled,
    );

    return apiSuccess({ classification }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
