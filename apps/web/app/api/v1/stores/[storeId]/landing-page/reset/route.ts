import { StoreService } from "@calcart/stores";
import {
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
} from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const storeService = new StoreService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);

    await requireStoreOrNotFound(ctx, storeId, "admin");

    let toDefault = true;
    let resetLive = true;
    try {
      const body = await req.json();
      if (typeof body?.toDefault === "boolean") {
        toDefault = body.toDefault;
      }
      if (typeof body?.resetLive === "boolean") {
        resetLive = body.resetLive;
      }
    } catch {
      // Body may be empty on plain POST; defaults to full reset
    }

    const updated = toDefault
      ? await storeService.resetLandingPageToDefault(ctx.db, storeId, auth.user.id, resetLive)
      : await storeService.resetLandingPageDraft(ctx.db, storeId, auth.user.id);

    return apiSuccess(updated, {
      requestId,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
