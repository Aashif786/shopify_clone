export type CurrencyRoundingRule = "NONE" | "NINETY_NINE" | "INTEGER";

export interface StoreCurrencyRow {
  store_id: string;
  currency: string;
  exchange_rate: string; // NUMERIC returned as string by pg
  rounding_rule: CurrencyRoundingRule;
  is_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertStoreCurrencyDbInput {
  storeId: string;
  currency: string;
  exchangeRate: number;
  roundingRule?: CurrencyRoundingRule;
  isEnabled?: boolean;
}
