/**
 * Frankfurter API Client and Foreign Exchange Engine.
 * Integrates with https://api.frankfurter.dev (v2 with v1 fallback) to provide
 * real-time, live currency conversion and exchange rates across CalCart.
 */

export interface FrankfurterRateItem {
  date: string;
  base: string;
  quote: string;
  rate: number;
}

export interface FrankfurterRatesResult {
  base: string;
  date: string;
  rates: Record<string, number>;
  source: "frankfurter";
  cachedAt?: number;
}

export interface CachedRatesEntry {
  result: FrankfurterRatesResult;
  expiresAt: number;
}

const memoryCache = new Map<string, CachedRatesEntry>();
// 15 minutes TTL for in-memory rates cache
const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Fetch live rates from Frankfurter API for a base currency.
 * Tries v2 /rates endpoint first (supports 200+ global currencies),
 * falling back to v1 /latest if needed.
 */
export async function fetchFrankfurterRates(
  baseCurrency: string = "USD",
  options?: { bypassCache?: boolean; timeoutMs?: number }
): Promise<FrankfurterRatesResult> {
  const base = baseCurrency.trim().toUpperCase();
  const cacheKey = `rates_${base}`;
  const now = Date.now();

  if (!options?.bypassCache) {
    const cached = memoryCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }
  }

  const timeoutMs = options?.timeoutMs ?? 5000;

  // 1. Try Frankfurter v2 API: https://api.frankfurter.dev/v2/rates?base=...
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const v2Url = `https://api.frankfurter.dev/v2/rates?base=${encodeURIComponent(base.toLowerCase())}`;
    const res = await fetch(v2Url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    }).finally(() => clearTimeout(timer));

    if (res.ok) {
      const data = (await res.json()) as Array<{ quote?: string; rate?: number; date?: string }>;
      if (Array.isArray(data) && data.length > 0) {
        const rates: Record<string, number> = { [base]: 1.0 };
        let date = data[0]?.date || new Date().toISOString().split("T")[0]!;

        for (const item of data) {
          if (item?.quote && typeof item?.rate === "number") {
            rates[item.quote.toUpperCase()] = item.rate;
            if (item.date) date = item.date;
          }
        }

        const result: FrankfurterRatesResult = {
          base,
          date,
          rates,
          source: "frankfurter",
          cachedAt: now,
        };

        memoryCache.set(cacheKey, {
          result,
          expiresAt: now + CACHE_TTL_MS,
        });

        return result;
      }
    }
  } catch {
    // v2 fetch failed, try v1 fallback below
  }

  // 2. Fallback to Frankfurter v1 API: https://api.frankfurter.dev/v1/latest?base=...
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const v1Url = `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}`;
    const res = await fetch(v1Url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    }).finally(() => clearTimeout(timer));

    if (res.ok) {
      const data = (await res.json()) as { date?: string; rates?: Record<string, number> };
      if (data && typeof data.rates === "object") {
        const rates: Record<string, number> = {
          [base]: 1.0,
          ...Object.fromEntries(
            Object.entries(data.rates).map(([k, v]) => [k.toUpperCase(), Number(v)])
          ),
        };

        const result: FrankfurterRatesResult = {
          base,
          date: data.date || new Date().toISOString().split("T")[0]!,
          rates,
          source: "frankfurter",
          cachedAt: now,
        };

        memoryCache.set(cacheKey, {
          result,
          expiresAt: now + CACHE_TTL_MS,
        });

        return result;
      }
    }
  } catch {
    // v1 fetch failed
  }

  // 3. If both fail and we have a stale cache entry, return it
  const stale = memoryCache.get(cacheKey);
  if (stale) {
    return stale.result;
  }

  throw new Error(`Failed to fetch exchange rates from Frankfurter API for base currency ${base}`);
}

/**
 * Fetch a single exchange rate between base and target currency from Frankfurter API.
 */
export async function fetchFrankfurterRate(
  baseCurrency: string,
  targetCurrency: string,
  options?: { bypassCache?: boolean }
): Promise<{ rate: number; date: string; source: "frankfurter" }> {
  const base = baseCurrency.trim().toUpperCase();
  const target = targetCurrency.trim().toUpperCase();

  if (base === target) {
    return {
      rate: 1.0,
      date: new Date().toISOString().split("T")[0]!,
      source: "frankfurter",
    };
  }

  const allRates = await fetchFrankfurterRates(base, options);
  const rate = allRates.rates[target];

  if (typeof rate !== "number" || rate <= 0) {
    throw new Error(
      `Frankfurter API did not return an exchange rate for quote ${target} with base ${base}`
    );
  }

  return {
    rate,
    date: allRates.date,
    source: "frankfurter",
  };
}
