import { StoreService } from "@calcart/stores";
import { CurrencyRepository } from "@calcart/db";
import {
  fetchFrankfurterRates,
  getCurrencyMetadata,
  type StoreCurrencyDTO,
  type StoreCurrenciesResponseDTO,
} from "@calcart/types";
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

    // Attempt to fetch live exchange rates from Frankfurter API for store base currency
    let frankfurterRates: Record<string, number> | null = null;
    let rateDate: string | undefined;
    let overallSource: "frankfurter" | "store" = "store";

    try {
      const liveData = await fetchFrankfurterRates(store.currency);
      frankfurterRates = liveData.rates;
      rateDate = liveData.date;
      overallSource = "frankfurter";
    } catch (fxErr) {
      console.warn(
        `[StorefrontCurrencies] Frankfurter API unavailable for ${store.currency}, using store rates:`,
        fxErr
      );
    }

    const currencies: StoreCurrencyDTO[] = rows.map((r) => {
      const meta = getCurrencyMetadata(r.currency);
      const isBase = r.currency === store.currency;

      let rate = Number(r.exchange_rate);
      let currentSource: "frankfurter" | "store" = "store";

      const liveRate = frankfurterRates ? frankfurterRates[r.currency] : undefined;
      if (isBase) {
        rate = 1.0;
      } else if (typeof liveRate === "number" && liveRate > 0) {
        rate = liveRate;
        currentSource = "frankfurter";
      }

      return {
        currency: r.currency,
        exchangeRate: rate,
        roundingRule: r.rounding_rule,
        isEnabled: r.is_enabled,
        symbol: meta.symbol,
        name: meta.name,
        decimals: meta.decimals,
        rateSource: currentSource,
        rateDate: currentSource === "frankfurter" ? rateDate : undefined,
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
        rateSource: "store",
      });
    }

    const response: StoreCurrenciesResponseDTO = {
      baseCurrency: store.currency,
      currencies,
      source: overallSource,
      date: rateDate,
    };

    return apiSuccess(response, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
