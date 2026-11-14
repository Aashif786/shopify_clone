import {
  GiftCardDepletedError,
  GiftCardDisabledError,
  GiftCardExpiredError,
  GiftCardService,
  normalizeGiftCardCode,
} from "@calcart/giftcards";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
} from "@/lib/api";
import { resolveStorefrontCustomer } from "@/lib/storefront-auth-helpers";

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

    const customer = await resolveStorefrontCustomer(ctx, store.id);
    if (!customer) {
      throw new ApiHttpError(
        401,
        "AUTHENTICATION_REQUIRED",
        "Please sign in to your account to redeem gift cards to your store credit balance",
      );
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

    const result = await ctx.db.withTransaction(async (tx) => {
      const card = await giftCardService.getGiftCardByCode(tx, store.id, normalized);

      if (card.status === "DISABLED") {
        throw new GiftCardDisabledError();
      }
      if (card.status === "DEPLETED" || card.currentBalance <= 0) {
        throw new GiftCardDepletedError();
      }
      if (card.expiresAt && new Date() > new Date(card.expiresAt)) {
        throw new GiftCardExpiredError();
      }

      const redeemAmount = card.currentBalance;

      // 1. Redeem gift card balance
      const redemptionResult = await giftCardService.redeemGiftCard(tx, store.id, card.id, {
        amount: redeemAmount,
        currency: card.currency,
        idempotencyKey: `giftcard:redeem:store-credit:${card.id}:${customer.id}`,
        notes: `Redeemed to customer ${customer.email} store credit balance`,
      });

      // 2. Issue store credit to customer account
      const creditResult = await giftCardService.issueStoreCredit(tx, store.id, customer.id, {
        amount: redeemAmount,
        currency: card.currency,
        idempotencyKey: `storecredit:from-giftcard:${card.id}`,
        notes: `Gift card ${card.maskedCode} redeemed to store credit`,
      });

      return {
        success: true,
        redeemedAmount: redeemAmount,
        currency: card.currency,
        maskedCode: card.maskedCode,
        newStoreCreditBalance: creditResult.storeCredit.currentBalance,
        giftCard: redemptionResult.giftCard,
      };
    });

    return apiSuccess(result, { requestId, status: 200 });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
