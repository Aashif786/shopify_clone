import { TaxService } from "@calcart/tax";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  updateTaxSettingsValidator,
  validateBody,
  validateUuid,
} from "@/lib/api";

const taxService = new TaxService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

/** The store's GST registration. Tax is off until a merchant enables it. */
export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const settings = await taxService.getSettings(ctx.db, storeId);
    return apiSuccess(settings, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

/**
 * Updates the registration. Admin only: these details are printed on legal
 * invoices and switching tax on changes what every customer is charged.
 */
export async function PATCH(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, updateTaxSettingsValidator);
    const settings = await taxService.updateSettings(ctx.db, storeId, body);
    return apiSuccess(settings, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
