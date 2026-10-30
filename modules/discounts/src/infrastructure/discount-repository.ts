import type { DatabaseClient } from "@calcart/db";
import { Discount } from "../domain/discount.js";
import type { DiscountRow, DiscountRedemptionRow } from "@calcart/db";
import type { DiscountType, DiscountStatus } from "../domain/discount-state.js";

export interface DiscountRedemption {
  id: string;
  discountId: string;
  storeId: string;
  orderId: string | null;
  checkoutId: string | null;
  customerId: string | null;
  amount: number;
  currency: string;
  createdAt: Date;
}

export interface CreateRedemptionData {
  id: string;
  discountId: string;
  storeId: string;
  orderId?: string | null;
  checkoutId?: string | null;
  customerId?: string | null;
  amount: number;
  currency: string;
}

function mapDiscountRow(row: DiscountRow): Discount {
  return Discount.reconstitute({
    id: row.id,
    storeId: row.store_id,
    code: row.code,
    name: row.name,
    description: row.description,
    type: row.type as DiscountType,
    value: Number(row.value),
    currency: row.currency,
    status: row.status as DiscountStatus,
    minimumSubtotal: Number(row.minimum_subtotal),
    maxDiscountAmount: row.max_discount_amount !== null ? Number(row.max_discount_amount) : null,
    usageLimit: row.usage_limit !== null ? Number(row.usage_limit) : null,
    usageCount: Number(row.usage_count),
    startsAt: row.starts_at ? new Date(row.starts_at) : null,
    endsAt: row.ends_at ? new Date(row.ends_at) : null,
    appliesToFirstTimeCustomer: Boolean(row.applies_to_first_time_customer),
    eligibleProductIds: (row.eligible_product_ids as string[]) ?? [],
    eligibleCollectionIds: (row.eligible_collection_ids as string[]) ?? [],
    eligibleCategoryIds: (row.eligible_category_ids as string[]) ?? [],
    eligibleProductTypeIds: (row.eligible_product_type_ids as string[]) ?? [],
    eligibleTagIds: (row.eligible_tag_ids as string[]) ?? [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

function mapRedemptionRow(row: DiscountRedemptionRow): DiscountRedemption {
  return {
    id: row.id,
    discountId: row.discount_id,
    storeId: row.store_id,
    orderId: row.order_id,
    checkoutId: row.checkout_id,
    customerId: row.customer_id,
    amount: Number(row.amount),
    currency: row.currency,
    createdAt: new Date(row.created_at),
  };
}

export class DiscountRepository {
  async create(client: DatabaseClient, discount: Discount): Promise<Discount> {
    const data = discount.toData();
    const query = `
      INSERT INTO discounts (
        id, store_id, code, name, description, type, value, currency,
        status, minimum_subtotal, max_discount_amount, usage_limit,
        usage_count, starts_at, ends_at, applies_to_first_time_customer,
        eligible_product_ids, eligible_collection_ids, eligible_category_ids,
        eligible_product_type_ids, eligible_tag_ids, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23
      )
      RETURNING *
    `;

    const values = [
      data.id,
      data.storeId,
      data.code,
      data.name,
      data.description,
      data.type,
      data.value,
      data.currency,
      data.status,
      data.minimumSubtotal,
      data.maxDiscountAmount,
      data.usageLimit,
      data.usageCount,
      data.startsAt,
      data.endsAt,
      data.appliesToFirstTimeCustomer,
      data.eligibleProductIds,
      data.eligibleCollectionIds,
      data.eligibleCategoryIds,
      data.eligibleProductTypeIds,
      data.eligibleTagIds,
      data.createdAt,
      data.updatedAt,
    ];

    const res = await client.query<DiscountRow>(query, values);
    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to insert discount");
    }
    return mapDiscountRow(row);
  }

  async findById(
    client: DatabaseClient,
    storeId: string,
    id: string,
    forUpdate: boolean = false,
  ): Promise<Discount | null> {
    const query = `
      SELECT * FROM discounts
      WHERE id = $1 AND store_id = $2
      ${forUpdate ? "FOR UPDATE" : ""}
    `;

    const res = await client.query<DiscountRow>(query, [id, storeId]);
    const row = res.rows[0];
    if (!row) return null;
    return mapDiscountRow(row);
  }

  async findByCode(
    client: DatabaseClient,
    storeId: string,
    code: string,
    forUpdate: boolean = false,
  ): Promise<Discount | null> {
    const query = `
      SELECT * FROM discounts
      WHERE store_id = $1 AND code = $2
      ${forUpdate ? "FOR UPDATE" : ""}
    `;

    const res = await client.query<DiscountRow>(query, [storeId, code]);
    const row = res.rows[0];
    if (!row) return null;
    return mapDiscountRow(row);
  }

  async update(client: DatabaseClient, discount: Discount): Promise<Discount> {
    const data = discount.toData();
    const query = `
      UPDATE discounts SET
        code = $1,
        name = $2,
        description = $3,
        type = $4,
        value = $5,
        currency = $6,
        status = $7,
        minimum_subtotal = $8,
        max_discount_amount = $9,
        usage_limit = $10,
        usage_count = $11,
        starts_at = $12,
        ends_at = $13,
        applies_to_first_time_customer = $14,
        eligible_product_ids = $15,
        eligible_collection_ids = $16,
        eligible_category_ids = $17,
        eligible_product_type_ids = $18,
        eligible_tag_ids = $19,
        updated_at = NOW()
      WHERE id = $20 AND store_id = $21
      RETURNING *
    `;

    const values = [
      data.code,
      data.name,
      data.description,
      data.type,
      data.value,
      data.currency,
      data.status,
      data.minimumSubtotal,
      data.maxDiscountAmount,
      data.usageLimit,
      data.usageCount,
      data.startsAt,
      data.endsAt,
      data.appliesToFirstTimeCustomer,
      data.eligibleProductIds,
      data.eligibleCollectionIds,
      data.eligibleCategoryIds,
      data.eligibleProductTypeIds,
      data.eligibleTagIds,
      data.id,
      data.storeId,
    ];

    const res = await client.query<DiscountRow>(query, values);
    const row = res.rows[0];
    if (!row) {
      throw new Error(`Failed to update discount '${data.id}'`);
    }
    return mapDiscountRow(row);
  }

  async deactivate(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<Discount | null> {
    const query = `
      UPDATE discounts SET
        status = 'DISABLED',
        updated_at = NOW()
      WHERE id = $1 AND store_id = $2
      RETURNING *
    `;

    const res = await client.query<DiscountRow>(query, [id, storeId]);
    const row = res.rows[0];
    if (!row) return null;
    return mapDiscountRow(row);
  }

  async listByStore(
    client: DatabaseClient,
    storeId: string,
  ): Promise<Discount[]> {
    const query = `
      SELECT * FROM discounts
      WHERE store_id = $1
      ORDER BY created_at DESC
    `;

    const res = await client.query<DiscountRow>(query, [storeId]);
    return res.rows.map(mapDiscountRow);
  }

  async atomicIncrementUsage(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<Discount | null> {
    const query = `
      UPDATE discounts
      SET usage_count = usage_count + 1,
          updated_at = NOW()
      WHERE id = $1
        AND store_id = $2
        AND status = 'ACTIVE'
        AND (usage_limit IS NULL OR usage_count < usage_limit)
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at > NOW())
      RETURNING *
    `;

    const res = await client.query<DiscountRow>(query, [id, storeId]);
    const row = res.rows[0];
    if (!row) return null;
    return mapDiscountRow(row);
  }

  async atomicDecrementUsage(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<Discount | null> {
    const query = `
      UPDATE discounts
      SET usage_count = GREATEST(0, usage_count - 1),
          updated_at = NOW()
      WHERE id = $1 AND store_id = $2
      RETURNING *
    `;

    const res = await client.query<DiscountRow>(query, [id, storeId]);
    const row = res.rows[0];
    if (!row) return null;
    return mapDiscountRow(row);
  }

  async createRedemption(
    client: DatabaseClient,
    redemption: CreateRedemptionData,
  ): Promise<DiscountRedemption> {
    const query = `
      INSERT INTO discount_redemptions (
        id, discount_id, store_id, order_id, checkout_id, customer_id, amount, currency
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      )
      RETURNING *
    `;

    const values = [
      redemption.id,
      redemption.discountId,
      redemption.storeId,
      redemption.orderId ?? null,
      redemption.checkoutId ?? null,
      redemption.customerId ?? null,
      redemption.amount,
      redemption.currency,
    ];

    const res = await client.query<DiscountRedemptionRow>(query, values);
    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to insert discount redemption");
    }
    return mapRedemptionRow(row);
  }

  async findRedemptionByOrder(
    client: DatabaseClient,
    storeId: string,
    discountId: string,
    orderId: string,
  ): Promise<DiscountRedemption | null> {
    const query = `
      SELECT * FROM discount_redemptions
      WHERE store_id = $1 AND discount_id = $2 AND order_id = $3
    `;

    const res = await client.query<DiscountRedemptionRow>(query, [storeId, discountId, orderId]);
    const row = res.rows[0];
    if (!row) return null;
    return mapRedemptionRow(row);
  }

  async deleteRedemptionByOrder(
    client: DatabaseClient,
    storeId: string,
    discountId: string,
    orderId: string,
  ): Promise<boolean> {
    const query = `
      DELETE FROM discount_redemptions
      WHERE store_id = $1 AND discount_id = $2 AND order_id = $3
      RETURNING id
    `;

    const res = await client.query<{ id: string }>(query, [storeId, discountId, orderId]);
    return (res.rowCount ?? 0) > 0;
  }
}
