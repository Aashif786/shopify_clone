import { NewsletterService } from "@calcart/customers";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
  validateBody,
} from "@/lib/api";
import {
  subscribeNewsletterValidator,
  type SubscribeNewsletterBodyDto,
} from "@/lib/api/validation";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";

const storeService = new StoreService();
const newsletterService = new NewsletterService();

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }

    const clientIp = getClientIp(req);
    const rateLimit = enforceRateLimit(
      `newsletter:subscribe:ip:${clientIp}`,
      15, // 15 attempts
      60_000, // per 60s
      requestId,
    );
    if (rateLimit) {
      return rateLimit;
    }

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);

    const body = await validateBody<SubscribeNewsletterBodyDto>(req, subscribeNewsletterValidator);

    const result = await newsletterService.subscribe(ctx.db, store.id, {
      email: body.email,
      source: body.source,
    });

    return apiSuccess(result, {
      status: result.isNew ? 201 : 200,
      requestId,
    });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
