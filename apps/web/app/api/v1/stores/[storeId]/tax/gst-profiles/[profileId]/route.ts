import { TaxService } from "@calcart/tax";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  updateGstProfileValidator,
  validateBody,
  validateUuid,
} from "@/lib/api";

const taxService = new TaxService();

interface RouteContext {
  params: Promise<{ storeId: string; profileId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, profileId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(profileId, "profileId");

    await requireStoreOrNotFound(ctx, storeId, "staff");

    const profile = await taxService.getGstProfileById(ctx.db, storeId, profileId);
    if (!profile) {
      throw new ApiHttpError(404, "NOT_FOUND", "GST profile not found");
    }

    return apiSuccess(profile, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function PUT(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, profileId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(profileId, "profileId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const body = await validateBody(req, updateGstProfileValidator);
    const profile = await taxService.updateGstProfile(
      ctx.db,
      storeId,
      profileId,
      body,
    );
    if (!profile) {
      throw new ApiHttpError(404, "NOT_FOUND", "GST profile not found");
    }

    return apiSuccess(profile, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, profileId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(profileId, "profileId");

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Operation requires at least admin role in this store",
      );
    }

    const deleted = await taxService.deleteGstProfile(ctx.db, storeId, profileId);
    if (!deleted) {
      throw new ApiHttpError(404, "NOT_FOUND", "GST profile not found");
    }

    return apiSuccess({ deleted: true }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
