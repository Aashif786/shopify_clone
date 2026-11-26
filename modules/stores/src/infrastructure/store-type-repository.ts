import type { DatabaseClient } from "@calcart/db";
import type { StoreType } from "../domain/store-type.js";

interface StoreTypeRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_fashion: boolean;
  created_at: Date;
  updated_at: Date;
  store_count?: string | number;
}

const COLUMNS = "id, key, name, description, is_fashion, created_at, updated_at";

function mapRow(row: StoreTypeRow): StoreType {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    isFashion: row.is_fashion,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class StoreTypeRepository {
  async list(
    client: DatabaseClient,
  ): Promise<Array<StoreType & { storeCount: number }>> {
    const res = await client.query<StoreTypeRow>(
      `SELECT t.id, t.key, t.name, t.description, t.is_fashion, t.created_at, t.updated_at,
              (SELECT COUNT(*) FROM stores s WHERE s.store_type_id = t.id) AS store_count
       FROM store_types t
       ORDER BY t.name ASC`,
    );
    return res.rows.map((r) => ({ ...mapRow(r), storeCount: Number(r.store_count ?? 0) }));
  }

  async findById(
    client: DatabaseClient,
    id: string,
    lock = false,
  ): Promise<StoreType | null> {
    const res = await client.query<StoreTypeRow>(
      `SELECT ${COLUMNS} FROM store_types WHERE id = $1${lock ? " FOR UPDATE" : ""}`,
      [id],
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  }

  async findByKey(client: DatabaseClient, key: string): Promise<StoreType | null> {
    const res = await client.query<StoreTypeRow>(
      `SELECT ${COLUMNS} FROM store_types WHERE key = $1`,
      [key],
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  }

  async insert(
    client: DatabaseClient,
    data: {
      id: string;
      key: string;
      name: string;
      description: string | null;
      isFashion: boolean;
    },
  ): Promise<StoreType> {
    const res = await client.query<StoreTypeRow>(
      `INSERT INTO store_types (id, key, name, description, is_fashion)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COLUMNS}`,
      [data.id, data.key, data.name, data.description, data.isFashion],
    );
    return mapRow(res.rows[0]!);
  }

  async update(
    client: DatabaseClient,
    id: string,
    data: {
      key?: string;
      name?: string;
      description?: string | null;
      isFashion?: boolean;
    },
  ): Promise<StoreType> {
    const updates: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [id];
    let i = 2;
    if (data.key !== undefined) {
      updates.push(`key = $${i++}`);
      values.push(data.key);
    }
    if (data.name !== undefined) {
      updates.push(`name = $${i++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${i++}`);
      values.push(data.description);
    }
    if (data.isFashion !== undefined) {
      updates.push(`is_fashion = $${i++}`);
      values.push(data.isFashion);
    }
    const res = await client.query<StoreTypeRow>(
      `UPDATE store_types SET ${updates.join(", ")} WHERE id = $1 RETURNING ${COLUMNS}`,
      values,
    );
    return mapRow(res.rows[0]!);
  }

  async remove(client: DatabaseClient, id: string): Promise<void> {
    await client.query(`DELETE FROM store_types WHERE id = $1`, [id]);
  }

  async countStores(client: DatabaseClient, id: string): Promise<number> {
    const res = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM stores WHERE store_type_id = $1`,
      [id],
    );
    return Number(res.rows[0]?.count ?? 0);
  }

  /** Moves stores to another type; stores moving to a non-fashion type lose Fit Check. */
  async reassignStores(
    client: DatabaseClient,
    fromId: string,
    toId: string,
    toIsFashion: boolean,
  ): Promise<number> {
    const res = await client.query(
      `UPDATE stores
       SET store_type_id = $2,
           fit_check_enabled = CASE WHEN $3::boolean THEN fit_check_enabled ELSE FALSE END,
           updated_at = NOW()
       WHERE store_type_id = $1`,
      [fromId, toId, toIsFashion],
    );
    return res.rowCount ?? 0;
  }

  /** Disables Fit Check on every store of a type that stopped being fashion. */
  async disableFitCheckForType(
    client: DatabaseClient,
    typeId: string,
  ): Promise<number> {
    const res = await client.query(
      `UPDATE stores SET fit_check_enabled = FALSE, updated_at = NOW()
       WHERE store_type_id = $1 AND fit_check_enabled = TRUE`,
      [typeId],
    );
    return res.rowCount ?? 0;
  }

  async getStoreClassification(
    client: DatabaseClient,
    storeId: string,
    lock = false,
  ): Promise<{ type: StoreType; fitCheckEnabled: boolean } | null> {
    const res = await client.query<StoreTypeRow & { fit_check_enabled: boolean }>(
      `SELECT t.id, t.key, t.name, t.description, t.is_fashion, t.created_at, t.updated_at,
              s.fit_check_enabled
       FROM stores s
       JOIN store_types t ON t.id = s.store_type_id
       WHERE s.id = $1${lock ? " FOR UPDATE OF s" : ""}`,
      [storeId],
    );
    const row = res.rows[0];
    return row ? { type: mapRow(row), fitCheckEnabled: row.fit_check_enabled } : null;
  }

  async setStoreClassification(
    client: DatabaseClient,
    storeId: string,
    data: { storeTypeId?: string; fitCheckEnabled?: boolean },
  ): Promise<void> {
    const updates: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [storeId];
    let i = 2;
    if (data.storeTypeId !== undefined) {
      updates.push(`store_type_id = $${i++}`);
      values.push(data.storeTypeId);
    }
    if (data.fitCheckEnabled !== undefined) {
      updates.push(`fit_check_enabled = $${i++}`);
      values.push(data.fitCheckEnabled);
    }
    await client.query(`UPDATE stores SET ${updates.join(", ")} WHERE id = $1`, values);
  }
}
