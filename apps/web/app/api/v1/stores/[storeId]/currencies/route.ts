import { StoreService } from "@calcart/stores";
import { CurrencyRepository } from "@calcart/db";
import {
  getCurrencyMetadata,
  type StoreCurrencyDTO,
  type StoreCurrenciesResponseDTO,
  type CurrencyRoundingRule,
} from "@calcart/types";
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
  params: Promise<{ storeId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    await requireStoreOrNotFound(ctx, storeId, "staff");

    const store = await storeService.getStoreById(ctx.db, storeId, ctx.auth!.user.id);
    const rows = await currencyRepository.listByStoreId(ctx.db, storeId, false);

    const currencies: StoreCurrencyDTO[] = rows.map((r) => {
      const meta = getCurrencyMetadata(r.currency);
      return {
        currency: r.currency,
        exchangeRate: Number(r.exchange_rate),
        roundingRule: r.rounding_rule as CurrencyRoundingRule,
        isEnabled: r.is_enabled,
        symbol: meta.symbol,
        name: meta.name,
        decimals: meta.decimals,
      };
    });

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

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    await requireStoreOrNotFound(ctx, storeId, "admin");

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new ApiHttpError(400, "INVALID_PAYLOAD", "Request body is required");
    }

    const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
    if (!currency || currency.length !== 3) {
      throw new ApiHttpError(400, "INVALID_CURRENCY", "Currency must be a 3-character ISO code");
    }

    const exchangeRate = Number(body.exchangeRate);
    if (isNaN(exchangeRate) || exchangeRate <= 0) {
      throw new ApiHttpError(400, "INVALID_EXCHANGE_RATE", "Exchange rate must be greater than 0");
    }

    const roundingRule = ["NONE", "NINETY_NINE", "INTEGER"].includes(body.roundingRule)
      ? (body.roundingRule as CurrencyRoundingRule)
      : "NONE";

    const isEnabled = typeof body.isEnabled === "boolean" ? body.isEnabled : true;

    const row = await currencyRepository.upsert(ctx.db, {
      storeId,
      currency,
      exchangeRate,
      roundingRule,
      isEnabled,
    });

    const meta = getCurrencyMetadata(row.currency);
    const dto: StoreCurrencyDTO = {
      currency: row.currency,
      exchangeRate: Number(row.exchange_rate),
      roundingRule: row.rounding_rule as CurrencyRoundingRule,
      isEnabled: row.is_enabled,
      symbol: meta.symbol,
      name: meta.name,
      decimals: meta.decimals,
    };

    return apiSuccess(dto, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
