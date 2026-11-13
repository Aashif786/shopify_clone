import {
  CurrencyRoundingRule,
  getCurrencyMetadata,
  KNOWN_CURRENCIES,
} from "@calcart/types";

export interface ConvertMinorUnitsOptions {
  amountMinor: number;
  exchangeRate: number;
  baseDecimals?: number;
  targetDecimals?: number;
  roundingRule?: CurrencyRoundingRule;
}

/**
 * Converts integer minor units from base currency to presentment currency.
 * Always returns integer minor units in the target currency.
 */
export function convertMinorUnits({
  amountMinor,
  exchangeRate,
  baseDecimals = 2,
  targetDecimals = 2,
  roundingRule = "NONE",
}: ConvertMinorUnitsOptions): number {
  if (amountMinor === 0 || exchangeRate <= 0) {
    return 0;
  }

  // 1. Calculate major units in base currency
  const baseMajor = amountMinor / Math.pow(10, baseDecimals);

  // 2. Convert to target currency major units
  const targetMajor = baseMajor * exchangeRate;

  // 3. Apply rounding rule
  if (roundingRule === "INTEGER") {
    const whole = Math.round(targetMajor);
    return Math.round(whole * Math.pow(10, targetDecimals));
  }

  if (roundingRule === "NINETY_NINE" && targetDecimals >= 2) {
    const floor = Math.floor(targetMajor);
    if (floor >= 1) {
      // .99 charm pricing: e.g. 19.99 => 1999 cents
      return floor * Math.pow(10, targetDecimals) + 99;
    }
  }

  // Default "NONE": standard rounding to target minor units
  return Math.round(targetMajor * Math.pow(10, targetDecimals));
}

export interface FormatCurrencyOptions {
  locale?: string;
  showCode?: boolean;
}

/**
 * Formats minor units into localized currency string (e.g., $19.99, ₹1,499.00, ¥2,500).
 */
export function formatCurrency(
  amountMinor: number,
  currencyCode: string = "INR",
  options: FormatCurrencyOptions = {}
): string {
  const meta = getCurrencyMetadata(currencyCode);
  const decimals = meta.decimals;
  const major = amountMinor / Math.pow(10, decimals);
  const locale = options.locale || "en-US";

  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: meta.code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(major);

    if (options.showCode) {
      return `${formatted} ${meta.code}`;
    }
    return formatted;
  } catch {
    // Fallback if browser/node environment doesn't recognize the currency code
    const sign = meta.symbol || meta.code;
    const fixed = major.toFixed(decimals);
    return `${sign}${fixed}`;
  }
}

export { KNOWN_CURRENCIES, getCurrencyMetadata };
