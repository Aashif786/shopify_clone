import type { Database, DatabaseClient } from "@calcart/db";
import type { ShippingOption } from "../domain/rate-evaluation.js";

type Client = Database | DatabaseClient;
type Money = string | number | bigint;

export interface ShippingSettingsRow {
  id: string;
  store_id: string;
  is_enabled: boolean;
  default_weight_grams: number;
  created_at: Date;
  updated_at: Date;
}

export interface ShippingZoneRow {
  id: string;
  store_id: string;
  name: string;
  country_codes: string[];
  state_codes: string[];
  postal_prefixes: string[];
  priority: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ShippingRateRow {
  id: string;
  store_id: string;
  zone_id: string;
  name: string;
  price: Money;
  min_weight_grams: number;
  max_weight_grams: number | null;
  min_subtotal: Money;
  max_subtotal: Money | null;
  free_over_subtotal: Money | null;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ProductShippingProfileRow {
  id: string;
  store_id: string;
  product_id: string;
  weight_grams: number;
  created_at: Date;
  updated_at: Date;
}

export interface CheckoutShippingQuoteRow {
  id: string;
  store_id: string;
  checkout_id: string;
  zone_id: string | null;
  zone_name: string | null;
  selected_rate_id: string | null;
  selected_rate_name: string | null;
  shipping_price: Money;
  total_weight_grams: Money;
  goods_subtotal: Money;
  options: ShippingOption[];
  destination: Record<string, unknown>;
  calculated_at: Date;
}

export interface ZoneData {
  name: string;
  countryCodes: string[];
  stateCodes: string[];
  postalPrefixes: string[];
  priority: number;
  isActive: boolean;
}

export interface RateData {
  name: string;
  price: number;
  minWeightGrams: number;
  maxWeightGrams: number | null;
  minSubtotal: number;
  maxSubtotal: number | null;
  freeOverSubtotal: number | null;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  isActive: boolean;
}

export interface UpsertQuoteData {
  id: string;
  storeId: string;
  checkoutId: string;
  zoneId: string | null;
  zoneName: string | null;
  selectedRateId: string | null;
  selectedRateName: string | null;
  shippingPrice: number;
  totalWeightGrams: number;
  goodsSubtotal: number;
  options: ShippingOption[];
  destination: Record<string, unknown>;
}

/**
 * Every statement is scoped by store id, and every cross-module reference in
 * the schema is a composite (id, store_id) foreign key.
 */
export class ShippingRepository {
  // --- Settings -----------------------------------------------------------

  async findSettings(client: Client, storeId: string): Promise<ShippingSettingsRow | null> {
    const res = await client.query<ShippingSettingsRow>(
      `SELECT * FROM shipping_settings WHERE store_id = $1`,
      [storeId],
    );
    return res.rows[0] ?? null;
  }

  async upsertSettings(
    client: Client,
    data: { id: string; storeId: string; isEnabled: boolean; defaultWeightGrams: number },
  ): Promise<ShippingSettingsRow> {
    const res = await client.query<ShippingSettingsRow>(
      `INSERT INTO shipping_settings (id, store_id, is_enabled, default_weight_grams)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (store_id) DO UPDATE SET
         is_enabled = EXCLUDED.is_enabled,
         default_weight_grams = EXCLUDED.default_weight_grams,
         updated_at = NOW()
       RETURNING *`,
      [data.id, data.storeId, data.isEnabled, data.defaultWeightGrams],
    );
    return res.rows[0]!;
  }

  // --- Zones --------------------------------------------------------------

  async listZones(client: Client, storeId: string): Promise<ShippingZoneRow[]> {
    const res = await client.query<ShippingZoneRow>(
      `SELECT * FROM shipping_zones WHERE store_id = $1 ORDER BY priority, created_at, id`,
      [storeId],
    );
    return res.rows;
  }

  async findZone(client: Client, storeId: string, zoneId: string): Promise<ShippingZoneRow | null> {
    const res = await client.query<ShippingZoneRow>(
      `SELECT * FROM shipping_zones WHERE store_id = $1 AND id = $2`,
      [storeId, zoneId],
    );
    return res.rows[0] ?? null;
  }

  async insertZone(
    client: Client,
    data: { id: string; storeId: string } & ZoneData,
  ): Promise<ShippingZoneRow> {
    const res = await client.query<ShippingZoneRow>(
      `INSERT INTO shipping_zones
         (id, store_id, name, country_codes, state_codes, postal_prefixes, priority, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.id,
        data.storeId,
        data.name,
        data.countryCodes,
        data.stateCodes,
        data.postalPrefixes,
        data.priority,
        data.isActive,
      ],
    );
    return res.rows[0]!;
  }

  async updateZone(
    client: Client,
    storeId: string,
    zoneId: string,
    data: ZoneData,
  ): Promise<ShippingZoneRow | null> {
    const res = await client.query<ShippingZoneRow>(
      `UPDATE shipping_zones SET
         name = $3, country_codes = $4, state_codes = $5, postal_prefixes = $6,
         priority = $7, is_active = $8, updated_at = NOW()
       WHERE store_id = $1 AND id = $2
       RETURNING *`,
      [
        storeId,
        zoneId,
        data.name,
        data.countryCodes,
        data.stateCodes,
        data.postalPrefixes,
        data.priority,
        data.isActive,
      ],
    );
    return res.rows[0] ?? null;
  }

  async deleteZone(client: Client, storeId: string, zoneId: string): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM shipping_zones WHERE store_id = $1 AND id = $2`,
      [storeId, zoneId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  // --- Rates --------------------------------------------------------------

  async listRates(client: Client, storeId: string): Promise<ShippingRateRow[]> {
    const res = await client.query<ShippingRateRow>(
      `SELECT * FROM shipping_rates WHERE store_id = $1 ORDER BY created_at, id`,
      [storeId],
    );
    return res.rows;
  }

  async insertRate(
    client: Client,
    data: { id: string; storeId: string; zoneId: string } & RateData,
  ): Promise<ShippingRateRow> {
    const res = await client.query<ShippingRateRow>(
      `INSERT INTO shipping_rates
         (id, store_id, zone_id, name, price, min_weight_grams, max_weight_grams,
          min_subtotal, max_subtotal, free_over_subtotal, estimated_days_min,
          estimated_days_max, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        data.id,
        data.storeId,
        data.zoneId,
        data.name,
        data.price,
        data.minWeightGrams,
        data.maxWeightGrams,
        data.minSubtotal,
        data.maxSubtotal,
        data.freeOverSubtotal,
        data.estimatedDaysMin,
        data.estimatedDaysMax,
        data.isActive,
      ],
    );
    return res.rows[0]!;
  }

  async updateRate(
    client: Client,
    storeId: string,
    rateId: string,
    data: RateData,
  ): Promise<ShippingRateRow | null> {
    const res = await client.query<ShippingRateRow>(
      `UPDATE shipping_rates SET
         name = $3, price = $4, min_weight_grams = $5, max_weight_grams = $6,
         min_subtotal = $7, max_subtotal = $8, free_over_subtotal = $9,
         estimated_days_min = $10, estimated_days_max = $11, is_active = $12,
         updated_at = NOW()
       WHERE store_id = $1 AND id = $2
       RETURNING *`,
      [
        storeId,
        rateId,
        data.name,
        data.price,
        data.minWeightGrams,
        data.maxWeightGrams,
        data.minSubtotal,
        data.maxSubtotal,
        data.freeOverSubtotal,
        data.estimatedDaysMin,
        data.estimatedDaysMax,
        data.isActive,
      ],
    );
    return res.rows[0] ?? null;
  }

  async deleteRate(client: Client, storeId: string, rateId: string): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM shipping_rates WHERE store_id = $1 AND id = $2`,
      [storeId, rateId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  // --- Product weights ----------------------------------------------------

  async findProfile(
    client: Client,
    storeId: string,
    productId: string,
  ): Promise<ProductShippingProfileRow | null> {
    const res = await client.query<ProductShippingProfileRow>(
      `SELECT * FROM product_shipping_profiles WHERE store_id = $1 AND product_id = $2`,
      [storeId, productId],
    );
    return res.rows[0] ?? null;
  }

  async findProfilesByProductIds(
    client: Client,
    storeId: string,
    productIds: string[],
  ): Promise<ProductShippingProfileRow[]> {
    if (productIds.length === 0) return [];
    const res = await client.query<ProductShippingProfileRow>(
      `SELECT * FROM product_shipping_profiles
       WHERE store_id = $1 AND product_id = ANY($2::uuid[])`,
      [storeId, productIds],
    );
    return res.rows;
  }

  async upsertProfile(
    client: Client,
    data: { id: string; storeId: string; productId: string; weightGrams: number },
  ): Promise<ProductShippingProfileRow | null> {
    const res = await client.query<ProductShippingProfileRow>(
      `INSERT INTO product_shipping_profiles (id, store_id, product_id, weight_grams)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id) DO UPDATE SET
         weight_grams = EXCLUDED.weight_grams,
         updated_at = NOW()
       WHERE product_shipping_profiles.store_id = EXCLUDED.store_id
       RETURNING *`,
      [data.id, data.storeId, data.productId, data.weightGrams],
    );
    // No row means the product's profile belongs to another store.
    return res.rows[0] ?? null;
  }

  async deleteProfile(client: Client, storeId: string, productId: string): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM product_shipping_profiles WHERE store_id = $1 AND product_id = $2`,
      [storeId, productId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  // --- Checkout quotes ----------------------------------------------------

  async findQuote(
    client: Client,
    storeId: string,
    checkoutId: string,
  ): Promise<CheckoutShippingQuoteRow | null> {
    const res = await client.query<CheckoutShippingQuoteRow>(
      `SELECT * FROM checkout_shipping_quotes WHERE store_id = $1 AND checkout_id = $2`,
      [storeId, checkoutId],
    );
    return res.rows[0] ?? null;
  }

  async upsertQuote(
    client: Client,
    data: UpsertQuoteData,
  ): Promise<CheckoutShippingQuoteRow | null> {
    const res = await client.query<CheckoutShippingQuoteRow>(
      `INSERT INTO checkout_shipping_quotes
         (id, store_id, checkout_id, zone_id, zone_name, selected_rate_id, selected_rate_name,
          shipping_price, total_weight_grams, goods_subtotal, options, destination)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)
       ON CONFLICT (checkout_id) DO UPDATE SET
         zone_id = EXCLUDED.zone_id,
         zone_name = EXCLUDED.zone_name,
         selected_rate_id = EXCLUDED.selected_rate_id,
         selected_rate_name = EXCLUDED.selected_rate_name,
         shipping_price = EXCLUDED.shipping_price,
         total_weight_grams = EXCLUDED.total_weight_grams,
         goods_subtotal = EXCLUDED.goods_subtotal,
         options = EXCLUDED.options,
         destination = EXCLUDED.destination,
         calculated_at = NOW()
       WHERE checkout_shipping_quotes.store_id = EXCLUDED.store_id
       RETURNING *`,
      [
        data.id,
        data.storeId,
        data.checkoutId,
        data.zoneId,
        data.zoneName,
        data.selectedRateId,
        data.selectedRateName,
        data.shippingPrice,
        data.totalWeightGrams,
        data.goodsSubtotal,
        JSON.stringify(data.options),
        JSON.stringify(data.destination),
      ],
    );
    return res.rows[0] ?? null;
  }

  async deleteQuote(client: Client, storeId: string, checkoutId: string): Promise<void> {
    await client.query(
      `DELETE FROM checkout_shipping_quotes WHERE store_id = $1 AND checkout_id = $2`,
      [storeId, checkoutId],
    );
  }
}
