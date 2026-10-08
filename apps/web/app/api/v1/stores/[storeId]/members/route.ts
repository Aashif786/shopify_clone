import { StoreService } from "@shopify-clone/stores";
import {
  addStoreMemberValidator,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";

const storeService = new StoreService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);

    await requireStoreOrNotFound(ctx, storeId, "admin");
    const members = await storeService.listStoreMembers(
      ctx.db,
      storeId,
      auth.user.id,
    );

    return apiSuccess({ items: members }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);

    await requireStoreOrNotFound(ctx, storeId, "admin");
    const validated = await validateBody(req, addStoreMemberValidator);
    const created = await storeService.addStoreMember(
      ctx.db,
      storeId,
      auth.user.id,
      validated,
    );

    return apiSuccess(created, { status: 201, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
