import { StoreService } from "@calcart/stores";
import { CurrencyRepository } from "@calcart/db";
import {
  fetchFrankfurterRates,
  getCurrencyMetadata,
  type StoreCurrencyDTO,
  type CurrencyRoundingRule,
} from "@calcart/types";
import {
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
  params: Promise<{ storeId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    await requireStoreOrNotFound(ctx, storeId, "admin");

    const store = await storeService.getStoreById(ctx.db, storeId, ctx.auth!.user.id);
    const rows = await currencyRepository.listByStoreId(ctx.db, storeId, false);

    // Fetch live rates from Frankfurter
    const liveData = await fetchFrankfurterRates(store.currency, { bypassCache: true });
    const rates = liveData.rates;

    let updatedCount = 0;
    const updatedCurrencies: StoreCurrencyDTO[] = [];

    for (const r of rows) {
      if (r.currency === store.currency) {
        continue;
      }
      const liveRate = rates[r.currency];
      if (typeof liveRate === "number" && liveRate > 0) {
        const saved = await currencyRepository.upsert(ctx.db, {
          storeId,
          currency: r.currency,
          exchangeRate: liveRate,
          roundingRule: r.rounding_rule as CurrencyRoundingRule,
          isEnabled: r.is_enabled,
        });

        const meta = getCurrencyMetadata(saved.currency);
        updatedCurrencies.push({
          currency: saved.currency,
          exchangeRate: Number(saved.exchange_rate),
          roundingRule: saved.rounding_rule as CurrencyRoundingRule,
          isEnabled: saved.is_enabled,
          symbol: meta.symbol,
          name: meta.name,
          decimals: meta.decimals,
          rateSource: "frankfurter",
          rateDate: liveData.date,
          liveRate,
        });
        updatedCount++;
      }
    }

    return apiSuccess(
      {
        synced: true,
        updatedCount,
        source: "frankfurter",
        date: liveData.date,
        currencies: updatedCurrencies,
      },
      { requestId }
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
