import { BodyProfileService } from "@calcart/customers";
import { apiSuccess, handleApiError } from "@/lib/api";
import {
  noStore,
  resolveFitCheckOwner,
  type FitCheckRouteContext,
} from "@/lib/api/fit-check-owner";

const bodyProfileService = new BodyProfileService();

/** The customer's persisted avatar; generated on demand if a profile exists without one. */
export async function GET(req: Request, context: FitCheckRouteContext) {
  let requestId: string | undefined;
  try {
    const { ctx, db, storeId, customerId } = await resolveFitCheckOwner(req, context);
    requestId = ctx.requestId;
    const avatar = await bodyProfileService.getOrCreateAvatar(db, storeId, customerId);
    return apiSuccess({ avatar }, noStore({ requestId }));
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

/** Regenerates the avatar from the saved body profile. */
export async function POST(req: Request, context: FitCheckRouteContext) {
  let requestId: string | undefined;
  try {
    const { ctx, db, storeId, customerId } = await resolveFitCheckOwner(req, context);
    requestId = ctx.requestId;
    const avatar = await bodyProfileService.regenerateAvatar(db, storeId, customerId);
    return apiSuccess({ avatar }, noStore({ requestId }));
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
