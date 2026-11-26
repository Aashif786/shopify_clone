import type { Database } from "@calcart/db";
import { generateUuidV7 } from "@calcart/db";
import { ProductNotFoundError, VariantNotFoundError } from "../domain/errors.js";
import {
  GarmentAssetNotFoundError,
  InvalidGarmentAssetError,
  assertValidGarmentReference,
  isGarmentFit,
  isGarmentSlot,
  isGarmentTemplate,
  slotForTemplate,
  type GarmentAsset,
  type GarmentAssetDTO,
  type SaveGarmentAssetInput,
  type SaveGeneratedGarmentInput,
} from "../domain/garment-asset.js";
import { GarmentAssetRepository } from "../infrastructure/garment-asset-repository.js";

function toDTO(a: GarmentAsset): GarmentAssetDTO {
  return {
    id: a.id,
    productId: a.productId,
    variantId: a.variantId,
    source: a.source,
    slot: a.slot,
    originalName: a.originalName,
    fileSize: a.fileSize,
    reference: a.reference,
    template: a.template,
    fit: a.fit,
    textureMediaId: a.textureMediaId,
    textureUrl: a.textureUrl,
    isEnabled: a.isEnabled,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

/** What a storefront needs to render a garment (no merchant-only metadata). */
export type StorefrontGarmentAsset = Pick<
  GarmentAssetDTO,
  "id" | "variantId" | "source" | "slot" | "reference" | "template" | "fit" | "textureUrl"
>;

export interface StorefrontGarmentCatalogEntry {
  productId: string;
  assets: StorefrontGarmentAsset[];
}

/**
 * Garment assets for Fit Check. A garment attaches to a product (applies to all its variants) or
 * to one variant; a variant's own asset wins over the product-level one.
 *
 * Two sources exist: an uploaded 3D model (`glb`), or a `generated` garment that the storefront
 * builds from a template + fit so it conforms to each customer's avatar, textured from a product
 * photo.
 *
 * Whether Fit Check is active for the store is checked by the caller (stores module). GLB bytes are
 * stored by the caller; this service owns metadata and tenancy rules.
 */
export class GarmentAssetService {
  private readonly repo = new GarmentAssetRepository();

  async listForProduct(db: Database, storeId: string, productId: string): Promise<GarmentAssetDTO[]> {
    if (!(await this.repo.productInStore(db, storeId, productId))) throw new ProductNotFoundError();
    return (await this.repo.listForProduct(db, storeId, productId)).map(toDTO);
  }

  /** Creates or replaces the uploaded-GLB asset for the product/variant scope. */
  async saveAsset(
    db: Database,
    storeId: string,
    productId: string,
    input: SaveGarmentAssetInput,
  ): Promise<{ asset: GarmentAssetDTO; replacedFileName: string | null }> {
    if (!isGarmentSlot(input.slot)) {
      throw new InvalidGarmentAssetError("Invalid garment slot", { fields: { slot: "Unsupported slot" } });
    }
    assertValidGarmentReference(input.reference);

    return db.withTransaction(async (tx) => {
      const variantId = await this.resolveScope(tx, storeId, productId, input.variantId);
      const { asset, replacedFileName } = await this.repo.replaceForScope(tx, {
        id: generateUuidV7(),
        storeId,
        productId,
        variantId,
        source: "glb",
        slot: input.slot,
        file: {
          fileName: input.fileName,
          originalName: input.originalName,
          fileSize: input.fileSize,
          sha256: input.sha256,
        },
        reference: input.reference,
        template: null,
        fit: null,
        textureMediaId: null,
      });
      return { asset: toDTO(asset), replacedFileName };
    });
  }

  /** Creates or replaces a photo-driven generated garment for the scope. */
  async saveGeneratedAsset(
    db: Database,
    storeId: string,
    productId: string,
    input: SaveGeneratedGarmentInput,
  ): Promise<{ asset: GarmentAssetDTO; replacedFileName: string | null }> {
    const fields: Record<string, string> = {};
    if (!isGarmentTemplate(input.template)) fields.template = "Unsupported garment type";
    if (!isGarmentFit(input.fit)) fields.fit = "Unsupported fit";
    if (Object.keys(fields).length > 0) {
      throw new InvalidGarmentAssetError("Invalid generated garment", { fields });
    }

    return db.withTransaction(async (tx) => {
      const variantId = await this.resolveScope(tx, storeId, productId, input.variantId);
      const mediaId = input.textureMediaId ?? null;
      if (mediaId && !(await this.repo.mediaInProduct(tx, storeId, productId, mediaId))) {
        throw new InvalidGarmentAssetError("The selected photo does not belong to this product", {
          fields: { textureMediaId: "Choose one of this product's images" },
        });
      }
      const { asset, replacedFileName } = await this.repo.replaceForScope(tx, {
        id: generateUuidV7(),
        storeId,
        productId,
        variantId,
        source: "generated",
        slot: slotForTemplate(input.template),
        file: null,
        reference: null,
        template: input.template,
        fit: input.fit,
        textureMediaId: mediaId,
      });
      return { asset: toDTO(asset), replacedFileName };
    });
  }

  private async resolveScope(
    tx: Parameters<GarmentAssetRepository["productInStore"]>[0],
    storeId: string,
    productId: string,
    variantId: string | null | undefined,
  ): Promise<string | null> {
    if (!(await this.repo.productInStore(tx, storeId, productId))) throw new ProductNotFoundError();
    const id = variantId ?? null;
    if (id && !(await this.repo.variantInProduct(tx, storeId, productId, id))) throw new VariantNotFoundError();
    return id;
  }

  async setEnabled(db: Database, storeId: string, assetId: string, enabled: boolean): Promise<GarmentAssetDTO> {
    const asset = await this.repo.setEnabled(db, storeId, assetId, enabled);
    if (!asset) throw new GarmentAssetNotFoundError();
    return toDTO(asset);
  }

  /** Deletes the metadata and returns the stored GLB file name (null for generated garments). */
  async removeAsset(db: Database, storeId: string, assetId: string): Promise<{ fileName: string | null }> {
    const removed = await this.repo.remove(db, storeId, assetId);
    if (!removed) throw new GarmentAssetNotFoundError();
    return { fileName: removed.fileName };
  }

  // -------------------- storefront --------------------

  private toStorefront(a: GarmentAsset): StorefrontGarmentAsset {
    const d = toDTO(a);
    return {
      id: d.id,
      variantId: d.variantId,
      source: d.source,
      slot: d.slot,
      reference: d.reference,
      template: d.template,
      fit: d.fit,
      textureUrl: d.textureUrl,
    };
  }

  /** Products that can be tried on, with their available assets. Unsupported products are absent. */
  async listStorefrontCatalog(db: Database, storeId: string): Promise<StorefrontGarmentCatalogEntry[]> {
    const byProduct = new Map<string, StorefrontGarmentCatalogEntry>();
    for (const a of await this.repo.listStorefrontAssets(db, storeId)) {
      const entry = byProduct.get(a.productId) ?? { productId: a.productId, assets: [] };
      entry.assets.push(this.toStorefront(a));
      byProduct.set(a.productId, entry);
    }
    return [...byProduct.values()];
  }

  /** Variant asset first, else the product-level asset, else null (unsupported). */
  async resolveForStorefront(
    db: Database,
    storeId: string,
    productId: string,
    variantId: string | null,
  ): Promise<StorefrontGarmentAsset | null> {
    const all = (await this.repo.listStorefrontAssets(db, storeId)).filter((a) => a.productId === productId);
    const match =
      (variantId ? all.find((a) => a.variantId === variantId) : undefined) ??
      all.find((a) => a.variantId === null) ??
      null;
    return match ? this.toStorefront(match) : null;
  }

  /** File name for a storefront-visible GLB asset, or null when it must not be served. */
  async getStorefrontFileName(db: Database, storeId: string, assetId: string): Promise<string | null> {
    const asset = await this.repo.findStorefrontAsset(db, storeId, assetId);
    return asset?.source === "glb" ? asset.fileName : null;
  }
}
