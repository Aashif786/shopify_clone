import type { Database, DatabaseClient } from "../database.js";
import type {
  StorePaymentGatewayRow,
  UpsertStorePaymentGatewayInput,
} from "../schema/payments.js";

export class StorePaymentGatewayRepository {
  async findByStoreAndProvider(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    provider: string,
  ): Promise<StorePaymentGatewayRow | null> {
    const res = await clientOrDb.query<StorePaymentGatewayRow>(
      `SELECT id, store_id, provider, key_id, key_secret, webhook_secret, is_enabled, created_at, updated_at
       FROM store_payment_gateways
       WHERE store_id = $1 AND UPPER(provider) = UPPER($2)
       LIMIT 1`,
      [storeId, provider],
    );
    return res.rows[0] ?? null;
  }

  async upsert(
    clientOrDb: Database | DatabaseClient,
    input: UpsertStorePaymentGatewayInput,
  ): Promise<StorePaymentGatewayRow> {
    const res = await clientOrDb.query<StorePaymentGatewayRow>(
      `INSERT INTO store_payment_gateways (
         id, store_id, provider, key_id, key_secret, webhook_secret, is_enabled, created_at, updated_at
       )
       VALUES ($1, $2, UPPER($3), $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (store_id, provider) DO UPDATE SET
         key_id = COALESCE(EXCLUDED.key_id, store_payment_gateways.key_id),
         key_secret = COALESCE(EXCLUDED.key_secret, store_payment_gateways.key_secret),
         webhook_secret = COALESCE(EXCLUDED.webhook_secret, store_payment_gateways.webhook_secret),
         is_enabled = EXCLUDED.is_enabled,
         updated_at = NOW()
       RETURNING id, store_id, provider, key_id, key_secret, webhook_secret, is_enabled, created_at, updated_at`,
      [
        input.id,
        input.storeId,
        input.provider,
        input.keyId ?? null,
        input.keySecret ?? null,
        input.webhookSecret ?? null,
        input.isEnabled,
      ],
    );
    return res.rows[0]!;
  }
}
