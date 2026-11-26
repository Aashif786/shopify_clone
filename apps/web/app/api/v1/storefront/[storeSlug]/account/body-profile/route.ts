import { BodyProfileService } from "@calcart/customers";
import {
  apiSuccess,
  handleApiError,
  validateBody,
} from "@/lib/api";
import { saveBodyProfileValidator } from "@/lib/api/fit-check-validators";
import { noStore, resolveFitCheckOwner as resolveOwner, type FitCheckRouteContext as RouteContext } from "@/lib/api/fit-check-owner";

const bodyProfileService = new BodyProfileService();

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const { ctx, db, storeId, customerId } = await resolveOwner(req, context);
    requestId = ctx.requestId;
    const profile = await bodyProfileService.getProfile(db, storeId, customerId);
    return apiSuccess({ profile }, noStore({ requestId }));
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function PUT(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const { ctx, db, storeId, customerId } = await resolveOwner(req, context);
    requestId = ctx.requestId;
    const validated = await validateBody(req, saveBodyProfileValidator);
    const profile = await bodyProfileService.saveProfile(db, storeId, customerId, validated);
    return apiSuccess({ profile }, noStore({ requestId }));
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const { ctx, db, storeId, customerId } = await resolveOwner(req, context);
    requestId = ctx.requestId;
    await bodyProfileService.deleteProfile(db, storeId, customerId);
    return apiSuccess({ deleted: true }, noStore({ requestId }));
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
