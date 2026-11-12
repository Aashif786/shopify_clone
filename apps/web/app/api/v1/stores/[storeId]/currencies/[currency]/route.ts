import { StoreService } from "@calcart/stores";
import { CurrencyRepository } from "@calcart/db";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const storeService = new StoreService();
const currencyRepository = new CurrencyRepository();

interface RouteContext {
  params: Promise<{ storeId: string; currency: string }>;
}

export async function DELETE(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, currency } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    await requireStoreOrNotFound(ctx, storeId, "admin");

    const code = currency.trim().toUpperCase();
    const store = await storeService.getStoreById(ctx.db, storeId, ctx.auth!.user.id);

    if (store.currency.toUpperCase() === code) {
      throw new ApiHttpError(
        400,
        "CANNOT_DELETE_BASE_CURRENCY",
        `Cannot remove the store's base operating currency (${store.currency})`
      );
    }

    const deleted = await currencyRepository.delete(ctx.db, storeId, code);
    if (!deleted) {
      throw new ApiHttpError(404, "CURRENCY_NOT_FOUND", `Currency ${code} is not configured`);
    }

    return apiSuccess({ success: true, currency: code }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
