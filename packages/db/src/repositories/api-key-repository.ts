import type { DatabaseClient } from "../database.js";
import { generateUuidV7 } from "../uuid.js";
import type {
  CreateStoreApiKeyInput,
  StoreApiKeyRow,
} from "../schema/api-keys.js";

export class ApiKeyRepository {
  async create(
    client: DatabaseClient,
    input: CreateStoreApiKeyInput,
  ): Promise<StoreApiKeyRow> {
    const id = input.id ?? generateUuidV7();
    const scopes = input.scopes ?? ["read:products", "read:orders"];

    const res = await client.query<StoreApiKeyRow>(
      `INSERT INTO store_api_keys (
         id, store_id, name, key_prefix, key_hash, scopes, expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [
        id,
        input.storeId,
        input.name,
        input.keyPrefix,
        input.keyHash,
        scopes,
        input.expiresAt ?? null,
      ],
    );

    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to create store API key");
    }
    return row;
  }

  async findByStoreId(
    client: DatabaseClient,
    storeId: string,
  ): Promise<StoreApiKeyRow[]> {
    const res = await client.query<StoreApiKeyRow>(
      `SELECT * FROM store_api_keys
       WHERE store_id = $1
       ORDER BY created_at DESC`,
      [storeId],
    );
    return res.rows;
  }

  async findById(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<StoreApiKeyRow | null> {
    const res = await client.query<StoreApiKeyRow>(
      `SELECT * FROM store_api_keys
       WHERE store_id = $1 AND id = $2`,
      [storeId, id],
    );
    return res.rows[0] ?? null;
  }

  async findByKeyHash(
    client: DatabaseClient,
    keyHash: string,
  ): Promise<StoreApiKeyRow | null> {
    const res = await client.query<StoreApiKeyRow>(
      `SELECT * FROM store_api_keys
       WHERE key_hash = $1 AND revoked_at IS NULL`,
      [keyHash],
    );
    return res.rows[0] ?? null;
  }

  async recordUsage(
    client: DatabaseClient,
    id: string,
  ): Promise<void> {
    await client.query(
      `UPDATE store_api_keys
       SET last_used_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id],
    );
  }

  async revoke(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<StoreApiKeyRow | null> {
    const res = await client.query<StoreApiKeyRow>(
      `UPDATE store_api_keys
       SET revoked_at = NOW(), updated_at = NOW()
       WHERE store_id = $1 AND id = $2 AND revoked_at IS NULL
       RETURNING *`,
      [storeId, id],
    );
    return res.rows[0] ?? null;
  }

  async delete(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM store_api_keys
       WHERE store_id = $1 AND id = $2`,
      [storeId, id],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
