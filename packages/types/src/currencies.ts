export type CurrencyRoundingRule = "NONE" | "NINETY_NINE" | "INTEGER";

export interface CurrencyMetadata {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface StoreCurrencyDTO {
  currency: string;
  exchangeRate: number;
  roundingRule: CurrencyRoundingRule;
  isEnabled: boolean;
  symbol: string;
  name: string;
  decimals: number;
}

export interface StoreCurrenciesResponseDTO {
  baseCurrency: string;
  currencies: StoreCurrencyDTO[];
}

export interface UpsertStoreCurrencyInput {
  currency: string;
  exchangeRate: number;
  roundingRule?: CurrencyRoundingRule;
  isEnabled?: boolean;
}

export const KNOWN_CURRENCIES: Record<string, CurrencyMetadata> = {
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee", decimals: 2 },
  USD: { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 },
  EUR: { code: "EUR", symbol: "€", name: "Euro", decimals: 2 },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", decimals: 2 },
  AED: { code: "AED", symbol: "د.إ", name: "UAE Dirham", decimals: 2 },
  CAD: { code: "CAD", symbol: "CA$", name: "Canadian Dollar", decimals: 2 },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", decimals: 2 },
  SGD: { code: "SGD", symbol: "S$", name: "Singapore Dollar", decimals: 2 },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", decimals: 0 },
  CHF: { code: "CHF", symbol: "CHF", name: "Swiss Franc", decimals: 2 },
  SAR: { code: "SAR", symbol: "﷼", name: "Saudi Riyal", decimals: 2 },
  QAR: { code: "QAR", symbol: "QR", name: "Qatari Riyal", decimals: 2 },
  NZD: { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", decimals: 2 },
  HKD: { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", decimals: 2 },
};

export function getCurrencyMetadata(code: string): CurrencyMetadata {
  const upper = code.toUpperCase();
  return KNOWN_CURRENCIES[upper] || {
    code: upper,
    symbol: upper,
    name: upper,
    decimals: 2,
  };
}
