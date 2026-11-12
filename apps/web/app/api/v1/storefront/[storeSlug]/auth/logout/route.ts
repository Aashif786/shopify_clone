import {
  revokeSession,
  serializeExpiredCustomerSessionCookie,
} from "@calcart/auth";
import { StoreService } from "@calcart/stores";
import {
  apiSuccess,
  handleApiError,
  resolveRequestContext,
} from "@/lib/api";

const storeService = new StoreService();

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug } = await Promise.resolve(context.params);
    // Verify store exists
    await storeService.getStoreBySlug(ctx.db, storeSlug);

    if (ctx.sessionId) {
      try {
        await revokeSession(ctx.db, ctx.sessionId);
      } catch (revokeErr) {
        // Even if session revocation fails (e.g. already revoked/expired), clear browser cookies
        console.warn("[storefront-logout] Session revocation error:", revokeErr);
      }
    }

    const storeCookie = serializeExpiredCustomerSessionCookie(storeSlug);
    const genericCookie = serializeExpiredCustomerSessionCookie(undefined);

    const headers = new Headers();
    headers.append("Set-Cookie", storeCookie);
    headers.append("Set-Cookie", genericCookie);

    return apiSuccess({ success: true }, { status: 200, headers, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
