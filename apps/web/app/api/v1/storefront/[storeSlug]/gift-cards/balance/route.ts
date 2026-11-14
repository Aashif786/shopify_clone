import { GiftCardService, normalizeGiftCardCode } from "@calcart/giftcards";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
} from "@/lib/api";

const storeService = new StoreService();
const giftCardService = new GiftCardService();

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

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(404, "STOREFRONT_NOT_FOUND", "Store is not publicly available");
    }

    const body: unknown = await req.json().catch(() => {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
    });
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
    }

    const record = body as Record<string, unknown>;
    const rawCode = typeof record.code === "string" ? record.code.trim() : "";
    if (!rawCode) {
      throw new ApiHttpError(400, "INVALID_GIFT_CARD_CODE", "Gift card code is required");
    }

    const normalized = normalizeGiftCardCode(rawCode);
    if (normalized.length < 4) {
      throw new ApiHttpError(400, "INVALID_GIFT_CARD_CODE", "Please enter a valid gift card code");
    }

    const card = await giftCardService.lookupGiftCard(ctx.db, store.id, normalized);

    return apiSuccess({ giftCard: card }, { requestId, status: 200 });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
