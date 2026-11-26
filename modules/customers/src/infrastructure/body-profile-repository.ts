import type { DatabaseClient } from "@calcart/db";
import type {
  BodyUnitPreference,
  CustomerBodyProfile,
} from "../domain/body-profile.js";

interface BodyProfileRow {
  id: string;
  store_id: string;
  customer_id: string;
  height_cm: string;
  weight_kg: string;
  chest_cm: string;
  waist_cm: string;
  hip_cm: string;
  unit_preference: BodyUnitPreference;
  consent_acknowledged_at: Date;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `id, store_id, customer_id, height_cm, weight_kg, chest_cm, waist_cm, hip_cm,
  unit_preference, consent_acknowledged_at, created_at, updated_at`;

function mapRow(row: BodyProfileRow): CustomerBodyProfile {
  return {
    id: row.id,
    storeId: row.store_id,
    customerId: row.customer_id,
    heightCm: Number(row.height_cm),
    weightKg: Number(row.weight_kg),
    chestCm: Number(row.chest_cm),
    waistCm: Number(row.waist_cm),
    hipCm: Number(row.hip_cm),
    unitPreference: row.unit_preference,
    consentAcknowledgedAt: new Date(row.consent_acknowledged_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/** Every query is scoped by BOTH store_id and customer_id. */
export class BodyProfileRepository {
  async find(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<CustomerBodyProfile | null> {
    const res = await client.query<BodyProfileRow>(
      `SELECT ${COLUMNS} FROM customer_body_profiles
       WHERE store_id = $1 AND customer_id = $2`,
      [storeId, customerId],
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  }

  async upsert(
    client: DatabaseClient,
    data: {
      id: string;
      storeId: string;
      customerId: string;
      heightCm: number;
      weightKg: number;
      chestCm: number;
      waistCm: number;
      hipCm: number;
      unitPreference: BodyUnitPreference;
    },
  ): Promise<CustomerBodyProfile> {
    const res = await client.query<BodyProfileRow>(
      `INSERT INTO customer_body_profiles
         (id, store_id, customer_id, height_cm, weight_kg, chest_cm, waist_cm, hip_cm,
          unit_preference, consent_acknowledged_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (store_id, customer_id) DO UPDATE SET
         height_cm = EXCLUDED.height_cm,
         weight_kg = EXCLUDED.weight_kg,
         chest_cm = EXCLUDED.chest_cm,
         waist_cm = EXCLUDED.waist_cm,
         hip_cm = EXCLUDED.hip_cm,
         unit_preference = EXCLUDED.unit_preference,
         updated_at = NOW()
       RETURNING ${COLUMNS}`,
      [
        data.id,
        data.storeId,
        data.customerId,
        data.heightCm,
        data.weightKg,
        data.chestCm,
        data.waistCm,
        data.hipCm,
        data.unitPreference,
      ],
    );
    return mapRow(res.rows[0]!);
  }

  async remove(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM customer_body_profiles WHERE store_id = $1 AND customer_id = $2`,
      [storeId, customerId],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
