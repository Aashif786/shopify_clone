import { StoreService } from "@calcart/stores";
import { CurrencyRepository } from "@calcart/db";
import { getCurrencyMetadata, type StoreCurrencyDTO, type StoreCurrenciesResponseDTO } from "@calcart/types";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
} from "@/lib/api";

const storeService = new StoreService();
const currencyRepository = new CurrencyRepository();

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

export async function GET(req: Request, context: RouteContext) {
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
      throw new ApiHttpError(
        404,
        "STOREFRONT_NOT_FOUND",
        "Store is not publicly available"
      );
    }

    const rows = await currencyRepository.listByStoreId(ctx.db, store.id, true);

    const currencies: StoreCurrencyDTO[] = rows.map((r) => {
      const meta = getCurrencyMetadata(r.currency);
      return {
        currency: r.currency,
        exchangeRate: Number(r.exchange_rate),
        roundingRule: r.rounding_rule,
        isEnabled: r.is_enabled,
        symbol: meta.symbol,
        name: meta.name,
        decimals: meta.decimals,
      };
    });

    // Ensure store's base currency is present in the list
    const hasBase = currencies.some((c) => c.currency === store.currency);
    if (!hasBase) {
      const baseMeta = getCurrencyMetadata(store.currency);
      currencies.unshift({
        currency: store.currency,
        exchangeRate: 1,
        roundingRule: "NONE",
        isEnabled: true,
        symbol: baseMeta.symbol,
        name: baseMeta.name,
        decimals: baseMeta.decimals,
      });
    }

    const response: StoreCurrenciesResponseDTO = {
      baseCurrency: store.currency,
      currencies,
    };

    return apiSuccess(response, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
