import type { DatabaseClient } from "@calcart/db";
import type { AvatarParams } from "../domain/avatar.js";

interface AvatarRow {
  generator_version: number;
  params: AvatarParams | string;
  generated_at: Date;
  updated_at: Date;
}

export interface StoredAvatar {
  generatorVersion: number;
  params: AvatarParams;
  generatedAt: Date;
  updatedAt: Date;
}

function mapRow(row: AvatarRow): StoredAvatar {
  return {
    generatorVersion: row.generator_version,
    params: typeof row.params === "string" ? (JSON.parse(row.params) as AvatarParams) : row.params,
    generatedAt: new Date(row.generated_at),
    updatedAt: new Date(row.updated_at),
  };
}

/** Every query is scoped by BOTH store_id and customer_id. */
export class AvatarRepository {
  async find(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<StoredAvatar | null> {
    const res = await client.query<AvatarRow>(
      `SELECT generator_version, params, generated_at, updated_at
       FROM customer_body_avatars WHERE store_id = $1 AND customer_id = $2`,
      [storeId, customerId],
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  }

  async upsert(
    client: DatabaseClient,
    data: { id: string; storeId: string; customerId: string; params: AvatarParams },
  ): Promise<StoredAvatar> {
    const res = await client.query<AvatarRow>(
      `INSERT INTO customer_body_avatars (id, store_id, customer_id, generator_version, params)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (store_id, customer_id) DO UPDATE SET
         generator_version = EXCLUDED.generator_version,
         params = EXCLUDED.params,
         updated_at = NOW()
       RETURNING generator_version, params, generated_at, updated_at`,
      [
        data.id,
        data.storeId,
        data.customerId,
        data.params.generatorVersion,
        JSON.stringify(data.params),
      ],
    );
    return mapRow(res.rows[0]!);
  }

  async remove(client: DatabaseClient, storeId: string, customerId: string): Promise<void> {
    await client.query(
      `DELETE FROM customer_body_avatars WHERE store_id = $1 AND customer_id = $2`,
      [storeId, customerId],
    );
  }
}
