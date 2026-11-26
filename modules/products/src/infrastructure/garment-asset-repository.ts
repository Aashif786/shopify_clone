import type { DatabaseClient } from "@calcart/db";
import type {
  GarmentAsset,
  GarmentFit,
  GarmentSlot,
  GarmentSource,
  GarmentTemplate,
} from "../domain/garment-asset.js";

interface Row {
  id: string;
  store_id: string;
  product_id: string;
  variant_id: string | null;
  source: GarmentSource;
  slot: GarmentSlot;
  file_name: string | null;
  original_name: string | null;
  file_size: number | null;
  sha256: string | null;
  reference_height_cm: string | null;
  reference_chest_cm: string | null;
  reference_waist_cm: string | null;
  reference_hip_cm: string | null;
  template: GarmentTemplate | null;
  fit: GarmentFit | null;
  texture_media_id: string | null;
  texture_url: string | null;
  is_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

/** Selected from `product_garment_assets g` joined as shown in FROM_CLAUSE. */
const COLUMNS = `g.id, g.store_id, g.product_id, g.variant_id, g.source, g.slot, g.file_name,
  g.original_name, g.file_size, g.sha256, g.reference_height_cm, g.reference_chest_cm,
  g.reference_waist_cm, g.reference_hip_cm, g.template, g.fit, g.texture_media_id,
  COALESCE(tm.url, pm0.url) AS texture_url, g.is_enabled, g.created_at, g.updated_at`;

const FROM_CLAUSE = `product_garment_assets g
  LEFT JOIN product_media tm ON tm.id = g.texture_media_id AND tm.product_id = g.product_id
  LEFT JOIN LATERAL (
    SELECT url FROM product_media m
    WHERE m.product_id = g.product_id AND m.variant_id IS NULL
    ORDER BY m.position, m.created_at LIMIT 1
  ) pm0 ON TRUE`;

function map(r: Row): GarmentAsset {
  const hasReference = r.reference_height_cm !== null;
  return {
    id: r.id,
    storeId: r.store_id,
    productId: r.product_id,
    variantId: r.variant_id,
    source: r.source,
    slot: r.slot,
    fileName: r.file_name,
    originalName: r.original_name,
    fileSize: r.file_size,
    sha256: r.sha256,
    reference: hasReference
      ? {
          heightCm: Number(r.reference_height_cm),
          chestCm: Number(r.reference_chest_cm),
          waistCm: Number(r.reference_waist_cm),
          hipCm: Number(r.reference_hip_cm),
        }
      : null,
    template: r.template,
    fit: r.fit,
    textureMediaId: r.texture_media_id,
    textureUrl: r.texture_url,
    isEnabled: r.is_enabled,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

export interface ReplaceGarmentData {
  id: string;
  storeId: string;
  productId: string;
  variantId: string | null;
  source: GarmentSource;
  slot: GarmentSlot;
  file: { fileName: string; originalName: string; fileSize: number; sha256: string } | null;
  reference: { heightCm: number; chestCm: number; waistCm: number; hipCm: number } | null;
  template: GarmentTemplate | null;
  fit: GarmentFit | null;
  textureMediaId: string | null;
}

/** Every query is scoped by store_id. */
export class GarmentAssetRepository {
  async productInStore(client: DatabaseClient, storeId: string, productId: string): Promise<boolean> {
    const res = await client.query(`SELECT 1 FROM products WHERE id = $1 AND store_id = $2`, [productId, storeId]);
    return res.rows.length > 0;
  }

  async variantInProduct(
    client: DatabaseClient,
    storeId: string,
    productId: string,
    variantId: string,
  ): Promise<boolean> {
    const res = await client.query(
      `SELECT 1 FROM product_variants WHERE id = $1 AND product_id = $2 AND store_id = $3`,
      [variantId, productId, storeId],
    );
    return res.rows.length > 0;
  }

  async mediaInProduct(
    client: DatabaseClient,
    storeId: string,
    productId: string,
    mediaId: string,
  ): Promise<boolean> {
    const res = await client.query(
      `SELECT 1 FROM product_media m JOIN products p ON p.id = m.product_id
       WHERE m.id = $1 AND m.product_id = $2 AND p.store_id = $3`,
      [mediaId, productId, storeId],
    );
    return res.rows.length > 0;
  }

  async listForProduct(client: DatabaseClient, storeId: string, productId: string): Promise<GarmentAsset[]> {
    const res = await client.query<Row>(
      `SELECT ${COLUMNS} FROM ${FROM_CLAUSE}
       WHERE g.store_id = $1 AND g.product_id = $2
       ORDER BY g.variant_id NULLS FIRST, g.created_at`,
      [storeId, productId],
    );
    return res.rows.map(map);
  }

  async findById(client: DatabaseClient, storeId: string, assetId: string): Promise<GarmentAsset | null> {
    const res = await client.query<Row>(
      `SELECT ${COLUMNS} FROM ${FROM_CLAUSE} WHERE g.id = $1 AND g.store_id = $2`,
      [assetId, storeId],
    );
    return res.rows[0] ? map(res.rows[0]) : null;
  }

  async findForScope(
    client: DatabaseClient,
    storeId: string,
    productId: string,
    variantId: string | null,
  ): Promise<GarmentAsset | null> {
    const res = await client.query<Row>(
      `SELECT ${COLUMNS} FROM ${FROM_CLAUSE}
       WHERE g.store_id = $1 AND g.product_id = $2 AND g.variant_id IS NOT DISTINCT FROM $3`,
      [storeId, productId, variantId],
    );
    return res.rows[0] ? map(res.rows[0]) : null;
  }

  /** Replaces the asset for a scope. Returns the new row and the replaced GLB file name (if any). */
  async replaceForScope(
    client: DatabaseClient,
    data: ReplaceGarmentData,
  ): Promise<{ asset: GarmentAsset; replacedFileName: string | null }> {
    const existing = await this.findForScope(client, data.storeId, data.productId, data.variantId);
    if (existing) {
      await client.query(`DELETE FROM product_garment_assets WHERE id = $1 AND store_id = $2`, [
        existing.id,
        data.storeId,
      ]);
    }
    await client.query(
      `INSERT INTO product_garment_assets
         (id, store_id, product_id, variant_id, source, slot, file_name, original_name, file_size, sha256,
          reference_height_cm, reference_chest_cm, reference_waist_cm, reference_hip_cm,
          template, fit, texture_media_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        data.id,
        data.storeId,
        data.productId,
        data.variantId,
        data.source,
        data.slot,
        data.file?.fileName ?? null,
        data.file?.originalName ?? null,
        data.file?.fileSize ?? null,
        data.file?.sha256 ?? null,
        data.reference?.heightCm ?? null,
        data.reference?.chestCm ?? null,
        data.reference?.waistCm ?? null,
        data.reference?.hipCm ?? null,
        data.template,
        data.fit,
        data.textureMediaId,
      ],
    );
    const asset = (await this.findById(client, data.storeId, data.id))!;
    return { asset, replacedFileName: existing?.fileName ?? null };
  }

  async setEnabled(
    client: DatabaseClient,
    storeId: string,
    assetId: string,
    enabled: boolean,
  ): Promise<GarmentAsset | null> {
    await client.query(
      `UPDATE product_garment_assets SET is_enabled = $3, updated_at = NOW() WHERE id = $1 AND store_id = $2`,
      [assetId, storeId, enabled],
    );
    return this.findById(client, storeId, assetId);
  }

  async remove(client: DatabaseClient, storeId: string, assetId: string): Promise<GarmentAsset | null> {
    const existing = await this.findById(client, storeId, assetId);
    if (!existing) return null;
    await client.query(`DELETE FROM product_garment_assets WHERE id = $1 AND store_id = $2`, [assetId, storeId]);
    return existing;
  }

  /** Enabled assets of ACTIVE products and variants — what a storefront may offer. */
  async listStorefrontAssets(
    client: DatabaseClient,
    storeId: string,
    assetId?: string,
  ): Promise<GarmentAsset[]> {
    const res = await client.query<Row>(
      `SELECT ${COLUMNS} FROM ${FROM_CLAUSE}
       JOIN products p ON p.id = g.product_id AND p.store_id = g.store_id
       LEFT JOIN product_variants v ON v.id = g.variant_id
       WHERE g.store_id = $1 AND g.is_enabled = TRUE AND p.status = 'ACTIVE'
         AND (g.variant_id IS NULL OR v.status = 'ACTIVE')
         AND ($2::uuid IS NULL OR g.id = $2::uuid)
       ORDER BY g.product_id, g.variant_id NULLS FIRST`,
      [storeId, assetId ?? null],
    );
    return res.rows.map(map);
  }

  async findStorefrontAsset(client: DatabaseClient, storeId: string, assetId: string): Promise<GarmentAsset | null> {
    return (await this.listStorefrontAssets(client, storeId, assetId))[0] ?? null;
  }
}
