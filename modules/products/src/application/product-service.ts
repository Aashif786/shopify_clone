import type { Database, DatabaseClient } from "@shopify-clone/db";
import { generateUuidV7 } from "@shopify-clone/db";
import type { PaginatedResult } from "@shopify-clone/types";
import type {
  Product,
  ProductMedia,
  ProductStatus,
  ProductVariant,
  ProductWithDetails,
} from "../domain/entities.js";
import {
  CannotDeleteLastVariantError,
  DuplicateProductSlugError,
  DuplicateSkuError,
  ProductNotFoundError,
  VariantNotFoundError,
} from "../domain/errors.js";
import {
  assertValidProductTransition,
  assertValidVariantTransition,
} from "../domain/lifecycle.js";
import {
  normalizeSlug,
  validateCompareAtPrice,
  validatePrice,
  validateProductPublishable,
  validateProductTitle,
  validateSku,
} from "../domain/validation.js";
import {
  ProductRepository,
  type ListProductsOptions,
} from "../infrastructure/product-repository.js";
import type {
  CreateProductInput,
  CreateVariantInput,
  ListProductsFilterOptions,
  ProductDetailDTO,
  ProductMediaDTO,
  ProductSummaryDTO,
  ProductVariantDTO,
  UpdateProductInput,
  UpdateVariantInput,
} from "./dtos.js";

function toProductVariantDTO(v: ProductVariant): ProductVariantDTO {
  return {
    id: v.id,
    productId: v.productId,
    title: v.title,
    sku: v.sku,
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    currency: v.currency,
    position: v.position,
    status: v.status,
    lowStockThreshold: v.lowStockThreshold,
    maxOrderQuantity: v.maxOrderQuantity,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

function toProductMediaDTO(m: ProductMedia): ProductMediaDTO {
  return {
    id: m.id,
    productId: m.productId,
    variantId: m.variantId,
    url: m.url,
    altText: m.altText,
    position: m.position,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

function toProductDetailDTO(details: ProductWithDetails): ProductDetailDTO {
  return {
    id: details.product.id,
    storeId: details.product.storeId,
    title: details.product.title,
    description: details.product.description,
    slug: details.product.slug,
    status: details.product.status,
    publishedAt: details.product.publishedAt
      ? details.product.publishedAt.toISOString()
      : null,
    lowStockThreshold: details.product.lowStockThreshold,
    maxOrderQuantity: details.product.maxOrderQuantity,
    variants: details.variants.map(toProductVariantDTO),
    media: details.media.map(toProductMediaDTO),
    createdAt: details.product.createdAt.toISOString(),
    updatedAt: details.product.updatedAt.toISOString(),
  };
}

function toProductSummaryDTO(item: {
  product: Product;
  variantsCount: number;
  mediaCount: number;
  price?: number | null;
  compareAtPrice?: number | null;
  currency?: string | null;
  primaryMediaUrl?: string | null;
  primaryMediaAlt?: string | null;
  totalAvailableQuantity?: number;
  isOutOfStock?: boolean;
  isLowStock?: boolean;
}): ProductSummaryDTO {
  return {
    id: item.product.id,
    storeId: item.product.storeId,
    title: item.product.title,
    slug: item.product.slug,
    status: item.product.status,
    publishedAt: item.product.publishedAt
      ? item.product.publishedAt.toISOString()
      : null,
    variantsCount: item.variantsCount,
    mediaCount: item.mediaCount,
    price: item.price !== undefined ? item.price : null,
    compareAtPrice: item.compareAtPrice !== undefined ? item.compareAtPrice : null,
    currency: item.currency ?? null,
    primaryMediaUrl: item.primaryMediaUrl ?? null,
    primaryMediaAlt: item.primaryMediaAlt ?? null,
    lowStockThreshold: item.product.lowStockThreshold,
    maxOrderQuantity: item.product.maxOrderQuantity,
    totalAvailableQuantity: item.totalAvailableQuantity,
    isOutOfStock: item.isOutOfStock,
    isLowStock: item.isLowStock,
    createdAt: item.product.createdAt.toISOString(),
    updatedAt: item.product.updatedAt.toISOString(),
  };
}

export class ProductService {
  constructor(
    private readonly repository: ProductRepository = new ProductRepository(),
  ) {}

  async createProduct(
    db: Database,
    storeId: string,
    input: CreateProductInput,
  ): Promise<ProductDetailDTO> {
    const title = validateProductTitle(input.title);
    const slug = normalizeSlug(input.slug || title);
    if (!slug) {
      throw new Error("Product slug cannot be empty");
    }

    const defaultCurrency = input.currency ?? "USD";

    return await db.withTransaction(async (tx) => {
      // 1. Check duplicate slug within store
      const existingSlug = await this.repository.findProductBySlug(
        tx,
        storeId,
        slug,
      );
      if (existingSlug) {
        throw new DuplicateProductSlugError(slug);
      }

      // 2. Insert product
      const productId = generateUuidV7();
      const status: ProductStatus = input.status ?? "DRAFT";
      const publishedAt = status === "ACTIVE" ? new Date() : null;

      await this.repository.insertProduct(tx, {
        id: productId,
        storeId,
        title,
        description: input.description,
        slug,
        status,
        publishedAt,
        lowStockThreshold: input.lowStockThreshold ?? 5,
        maxOrderQuantity: input.maxOrderQuantity ?? null,
      });

      // 3. Handle variants
      const variantsToCreate =
        input.variants && input.variants.length > 0
          ? input.variants
          : [
              {
                title: "Default Title",
                sku: input.sku ?? null,
                price: input.price ?? 0,
                compareAtPrice: input.compareAtPrice ?? null,
                position: 0,
                lowStockThreshold: null,
                maxOrderQuantity: null,
              },
            ];

      for (let i = 0; i < variantsToCreate.length; i++) {
        const v = variantsToCreate[i]!;
        const vPrice = validatePrice(v.price);
        const vCompareAt = validateCompareAtPrice(v.compareAtPrice);
        const vSku = validateSku(v.sku);

        if (vSku) {
          const existingSku = await this.repository.findVariantBySku(
            tx,
            storeId,
            vSku,
          );
          if (existingSku) {
            throw new DuplicateSkuError(vSku);
          }
        }

        await this.repository.insertVariant(tx, {
          id: generateUuidV7(),
          productId,
          storeId,
          title: v.title?.trim() || "Default Title",
          sku: vSku,
          price: vPrice,
          compareAtPrice: vCompareAt,
          currency: defaultCurrency,
          position: v.position ?? i,
          status: "ACTIVE",
          lowStockThreshold: v.lowStockThreshold ?? null,
          maxOrderQuantity: v.maxOrderQuantity ?? null,
        });
      }

      // 4. Handle initial media if provided
      if (input.media && input.media.length > 0) {
        for (let i = 0; i < input.media.length; i++) {
          const m = input.media[i]!;
          await this.repository.insertMedia(tx, {
            id: generateUuidV7(),
            productId,
            url: m.url.trim(),
            altText: m.altText ?? null,
            position: m.position ?? i,
          });
        }
      }

      const details = await this.repository.getProductWithDetails(
        tx,
        storeId,
        productId,
      );
      if (!details) {
        throw new ProductNotFoundError();
      }

      return toProductDetailDTO(details);
    });
  }

  async getProductById(
    client: DatabaseClient,
    storeId: string,
    productId: string,
  ): Promise<ProductDetailDTO> {
    const details = await this.repository.getProductWithDetails(
      client,
      storeId,
      productId,
    );
    if (!details) {
      throw new ProductNotFoundError();
    }
    return toProductDetailDTO(details);
  }

  async getProductBySlug(
    client: DatabaseClient,
    storeId: string,
    slug: string,
  ): Promise<ProductDetailDTO> {
    const product = await this.repository.findProductBySlug(
      client,
      storeId,
      slug,
    );
    if (!product) {
      throw new ProductNotFoundError();
    }
    const variants = await this.repository.listVariantsByProductId(
      client,
      storeId,
      product.id,
    );
    const media = await this.repository.listMediaByProductId(
      client,
      product.id,
    );
    return toProductDetailDTO({ product, variants, media });
  }

  async listProducts(
    client: DatabaseClient,
    storeId: string,
    options?: ListProductsFilterOptions,
  ): Promise<PaginatedResult<ProductSummaryDTO>> {
    const opts: ListProductsOptions = {
      storeId,
      status: options?.status,
      limit: options?.limit,
      cursor: options?.cursor,
      search: options?.search,
      minPrice: options?.minPrice,
      maxPrice: options?.maxPrice,
      inStock: options?.inStock,
      sortBy: options?.sortBy,
      collectionId: options?.collectionId,
      collectionSlug: options?.collectionSlug,
    };

    const res = await this.repository.listProducts(client, opts);
    return {
      items: res.items.map(toProductSummaryDTO),
      hasMore: res.hasMore,
      nextCursor: res.nextCursor,
    };
  }

  async updateProduct(
    db: Database,
    storeId: string,
    productId: string,
    input: UpdateProductInput,
  ): Promise<ProductDetailDTO> {
    return await db.withTransaction(async (tx) => {
      const existing = await this.repository.findProductById(
        tx,
        storeId,
        productId,
      );
      if (!existing) {
        throw new ProductNotFoundError();
      }

      const updates: {
        title?: string;
        description?: string | null;
        slug?: string;
        lowStockThreshold?: number;
        maxOrderQuantity?: number | null;
      } = {};

      if (input.title !== undefined) {
        updates.title = validateProductTitle(input.title);
      }
      if (input.description !== undefined) {
        updates.description = input.description;
      }
      if (input.lowStockThreshold !== undefined) {
        updates.lowStockThreshold = input.lowStockThreshold;
      }
      if (input.maxOrderQuantity !== undefined) {
        updates.maxOrderQuantity = input.maxOrderQuantity;
      }
      if (input.slug !== undefined) {
        const normalized = normalizeSlug(input.slug);
        if (!normalized) {
          throw new Error("Product slug cannot be empty");
        }
        if (normalized !== existing.slug) {
          const conflict = await this.repository.findProductBySlug(
            tx,
            storeId,
            normalized,
          );
          if (conflict && conflict.id !== productId) {
            throw new DuplicateProductSlugError(normalized);
          }
          updates.slug = normalized;
        }
      }

      await this.repository.updateProduct(tx, storeId, productId, updates);

      const details = await this.repository.getProductWithDetails(
        tx,
        storeId,
        productId,
      );
      return toProductDetailDTO(details!);
    });
  }

  async publishProduct(
    db: Database,
    storeId: string,
    productId: string,
  ): Promise<ProductDetailDTO> {
    return await db.withTransaction(async (tx) => {
      const details = await this.repository.getProductWithDetails(
        tx,
        storeId,
        productId,
      );
      if (!details) {
        throw new ProductNotFoundError();
      }

      assertValidProductTransition(details.product.status, "ACTIVE");
      validateProductPublishable(details.product, details.variants);

      await this.repository.updateProduct(tx, storeId, productId, {
        status: "ACTIVE",
        publishedAt: new Date(),
      });

      const updated = await this.repository.getProductWithDetails(
        tx,
        storeId,
        productId,
      );
      return toProductDetailDTO(updated!);
    });
  }

  async unpublishProduct(
    db: Database,
    storeId: string,
    productId: string,
  ): Promise<ProductDetailDTO> {
    return await db.withTransaction(async (tx) => {
      const existing = await this.repository.findProductById(
        tx,
        storeId,
        productId,
      );
      if (!existing) {
        throw new ProductNotFoundError();
      }

      assertValidProductTransition(existing.status, "DRAFT");

      await this.repository.updateProduct(tx, storeId, productId, {
        status: "DRAFT",
      });

      const updated = await this.repository.getProductWithDetails(
        tx,
        storeId,
        productId,
      );
      return toProductDetailDTO(updated!);
    });
  }

  async archiveProduct(
    db: Database,
    storeId: string,
    productId: string,
  ): Promise<ProductDetailDTO> {
    return await db.withTransaction(async (tx) => {
      const existing = await this.repository.findProductById(
        tx,
        storeId,
        productId,
      );
      if (!existing) {
        throw new ProductNotFoundError();
      }

      assertValidProductTransition(existing.status, "ARCHIVED");

      await this.repository.updateProduct(tx, storeId, productId, {
        status: "ARCHIVED",
      });

      const updated = await this.repository.getProductWithDetails(
        tx,
        storeId,
        productId,
      );
      return toProductDetailDTO(updated!);
    });
  }

  async createVariant(
    db: Database,
    storeId: string,
    productId: string,
    input: CreateVariantInput,
  ): Promise<ProductVariantDTO> {
    const price = validatePrice(input.price);
    const compareAtPrice = validateCompareAtPrice(input.compareAtPrice);
    const sku = validateSku(input.sku);
    const title = input.title?.trim() || "Default Title";

    return await db.withTransaction(async (tx) => {
      const product = await this.repository.findProductById(
        tx,
        storeId,
        productId,
      );
      if (!product) {
        throw new ProductNotFoundError();
      }

      if (sku) {
        const existingSku = await this.repository.findVariantBySku(
          tx,
          storeId,
          sku,
        );
        if (existingSku) {
          throw new DuplicateSkuError(sku);
        }
      }

      const existingVariants = await this.repository.listVariantsByProductId(
        tx,
        storeId,
        productId,
      );
      const currency = existingVariants[0]?.currency ?? "USD";
      const nextPosition =
        input.position ??
        (existingVariants.length > 0
          ? Math.max(...existingVariants.map((v) => v.position)) + 1
          : 0);

      const variant = await this.repository.insertVariant(tx, {
        id: generateUuidV7(),
        productId,
        storeId,
        title,
        sku,
        price,
        compareAtPrice,
        currency,
        position: nextPosition,
        status: "ACTIVE",
        lowStockThreshold: input.lowStockThreshold ?? null,
        maxOrderQuantity: input.maxOrderQuantity ?? null,
      });

      return toProductVariantDTO(variant);
    });
  }

  async updateVariant(
    db: Database,
    storeId: string,
    productId: string,
    variantId: string,
    input: UpdateVariantInput,
  ): Promise<ProductVariantDTO> {
    return await db.withTransaction(async (tx) => {
      const existing = await this.repository.findVariantById(
        tx,
        storeId,
        productId,
        variantId,
      );
      if (!existing) {
        throw new VariantNotFoundError();
      }

      const updates: {
        title?: string;
        sku?: string | null;
        price?: number;
        compareAtPrice?: number | null;
        position?: number;
        status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
        lowStockThreshold?: number | null;
        maxOrderQuantity?: number | null;
      } = {};

      if (input.title !== undefined) {
        updates.title = input.title.trim() || "Default Title";
      }
      if (input.price !== undefined) {
        updates.price = validatePrice(input.price);
      }
      if (input.compareAtPrice !== undefined) {
        updates.compareAtPrice = validateCompareAtPrice(input.compareAtPrice);
      }
      if (input.position !== undefined) {
        updates.position = input.position;
      }
      if (input.lowStockThreshold !== undefined) {
        updates.lowStockThreshold = input.lowStockThreshold;
      }
      if (input.maxOrderQuantity !== undefined) {
        updates.maxOrderQuantity = input.maxOrderQuantity;
      }
      if (input.sku !== undefined) {
        const newSku = validateSku(input.sku);
        if (newSku && newSku !== existing.sku) {
          const conflict = await this.repository.findVariantBySku(
            tx,
            storeId,
            newSku,
          );
          if (conflict && conflict.id !== variantId) {
            throw new DuplicateSkuError(newSku);
          }
        }
        updates.sku = newSku;
      }
      if (input.status !== undefined) {
        assertValidVariantTransition(existing.status, input.status);
        updates.status = input.status;
      }

      const updated = await this.repository.updateVariant(
        tx,
        storeId,
        productId,
        variantId,
        updates,
      );

      return toProductVariantDTO(updated!);
    });
  }

  async deleteVariant(
    db: Database,
    storeId: string,
    productId: string,
    variantId: string,
  ): Promise<void> {
    await db.withTransaction(async (tx) => {
      const existing = await this.repository.findVariantById(
        tx,
        storeId,
        productId,
        variantId,
      );
      if (!existing) {
        throw new VariantNotFoundError();
      }

      const count = await this.repository.countVariants(
        tx,
        storeId,
        productId,
      );
      if (count <= 1) {
        throw new CannotDeleteLastVariantError();
      }

      await this.repository.deleteVariant(tx, storeId, productId, variantId);
    });
  }

  async listVariants(
    client: DatabaseClient,
    storeId: string,
    productId: string,
  ): Promise<ProductVariantDTO[]> {
    const product = await this.repository.findProductById(
      client,
      storeId,
      productId,
    );
    if (!product) {
      throw new ProductNotFoundError();
    }
    const variants = await this.repository.listVariantsByProductId(
      client,
      storeId,
      productId,
    );
    return variants.map(toProductVariantDTO);
  }
}
