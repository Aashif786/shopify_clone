import { TaxService } from "@calcart/tax";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  createGstProfileValidator,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
  validateUuid,
} from "@/lib/api";

const taxService = new TaxService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

/**
 * List all GST profiles / slabs for a store.
 */
export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const items = await taxService.listGstProfiles(ctx.db, storeId);
    return apiSuccess({ items }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

/**
 * Create a new GST profile / slab.
 */
export async function POST(req: Request, context: RouteContext) {
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

    const body = await validateBody(req, createGstProfileValidator);
    const profile = await taxService.createGstProfile(ctx.db, storeId, body);
    return apiSuccess(profile, { requestId, status: 201 });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
