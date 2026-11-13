import type { DatabaseClient } from "../database.js";
import type {
  StoreCurrencyRow,
  UpsertStoreCurrencyDbInput,
} from "../schema/currencies.js";

export class CurrencyRepository {
  async listByStoreId(
    client: DatabaseClient,
    storeId: string,
    enabledOnly: boolean = false
  ): Promise<StoreCurrencyRow[]> {
    const query = enabledOnly
      ? `SELECT * FROM store_currencies WHERE store_id = $1 AND is_enabled = true ORDER BY currency ASC`
      : `SELECT * FROM store_currencies WHERE store_id = $1 ORDER BY currency ASC`;

    const res = await client.query<StoreCurrencyRow>(query, [storeId]);
    return res.rows;
  }

  async getByCurrency(
    client: DatabaseClient,
    storeId: string,
    currency: string
  ): Promise<StoreCurrencyRow | null> {
    const res = await client.query<StoreCurrencyRow>(
      `SELECT * FROM store_currencies WHERE store_id = $1 AND currency = $2`,
      [storeId, currency.toUpperCase()]
    );
    return res.rows[0] ?? null;
  }

  async upsert(
    client: DatabaseClient,
    input: UpsertStoreCurrencyDbInput
  ): Promise<StoreCurrencyRow> {
    const currency = input.currency.toUpperCase();
    const roundingRule = input.roundingRule ?? "NONE";
    const isEnabled = input.isEnabled ?? true;

    const res = await client.query<StoreCurrencyRow>(
      `INSERT INTO store_currencies (
         store_id, currency, exchange_rate, rounding_rule, is_enabled, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (store_id, currency) DO UPDATE SET
         exchange_rate = EXCLUDED.exchange_rate,
         rounding_rule = EXCLUDED.rounding_rule,
         is_enabled = EXCLUDED.is_enabled,
         updated_at = NOW()
       RETURNING *`,
      [input.storeId, currency, input.exchangeRate, roundingRule, isEnabled]
    );

    const row = res.rows[0];
    if (!row) {
      throw new Error(`Failed to upsert currency ${currency} for store ${input.storeId}`);
    }
    return row;
  }

  async delete(
    client: DatabaseClient,
    storeId: string,
    currency: string
  ): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM store_currencies WHERE store_id = $1 AND currency = $2`,
      [storeId, currency.toUpperCase()]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
