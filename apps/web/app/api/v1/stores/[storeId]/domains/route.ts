import { StoreService } from "@shopify-clone/stores";
import {
  apiSuccess,
  handleApiError,
  parseJsonBody,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
} from "@/lib/api";
import { ApiHttpError } from "@/lib/api/errors";

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

    await requireStoreOrNotFound(ctx, storeId);
    const domainsData = await storeService.getStoreDomains(
      ctx.db,
      storeId,
      auth.user.id,
    );

    return apiSuccess(domainsData, { requestId });
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

    await requireStoreOrNotFound(ctx, storeId);

    const body = await parseJsonBody<{ domain?: unknown }>(req);
    if (!body || typeof body.domain !== "string" || !body.domain.trim()) {
      throw new ApiHttpError(
        400,
        "VALIDATION_ERROR",
        "Domain is required and must be a valid string",
        {
          fields: {
            domain: "Please provide a valid domain hostname (e.g. shop.example.com or example.com)",
          },
        },
      );
    }

    const created = await storeService.addCustomDomain(
      ctx.db,
      storeId,
      auth.user.id,
      { domain: body.domain.trim() },
    );

    return apiSuccess(created, { status: 201, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
