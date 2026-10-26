import type { Database, DatabaseClient } from "@shopify-clone/db";
import { generateUuidV7 } from "@shopify-clone/db";
import type { PaginatedResult } from "@shopify-clone/types";
import type {
  Category,
  Product,
  ProductMedia,
  ProductOption,
  ProductStatus,
  ProductTag,
  ProductType,
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
  CategoryDTO,
  CreateCategoryInput,
  CreateProductInput,
  CreateProductOptionInput,
  CreateProductTypeInput,
  CreateVariantInput,
  ListProductsFilterOptions,
  ProductDetailDTO,
  ProductMediaDTO,
  ProductOptionDTO,
  ProductSummaryDTO,
  ProductTagDTO,
  ProductTypeDTO,
  ProductVariantDTO,
  UpdateCategoryInput,
  UpdateProductInput,
  UpdateProductTypeInput,
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
    option1: v.option1 ?? null,
    option2: v.option2 ?? null,
    option3: v.option3 ?? null,
    imageId: v.imageId ?? null,
    imageUrl: v.imageUrl ?? null,
    inventoryQuantity: v.inventoryQuantity,
    lowStockThreshold: v.lowStockThreshold,
    maxOrderQuantity: v.maxOrderQuantity,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

function toProductOptionDTO(opt: ProductOption): ProductOptionDTO {
  return {
    id: opt.id,
    productId: opt.productId,
    name: opt.name,
    position: opt.position,
    values: opt.values,
    createdAt: opt.createdAt.toISOString(),
    updatedAt: opt.updatedAt.toISOString(),
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

function toProductTypeDTO(t: ProductType): ProductTypeDTO {
  return {
    id: t.id,
    storeId: t.storeId,
    name: t.name,
    slug: t.slug,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

function toCategoryDTO(c: Category): CategoryDTO {
  return {
    id: c.id,
    storeId: c.storeId,
    parentId: c.parentId,
    name: c.name,
    slug: c.slug,
    description: c.description,
    position: c.position,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function toProductTagDTO(pt: ProductTag): ProductTagDTO {
  return {
    id: pt.id,
    storeId: pt.storeId,
    name: pt.name,
    normalizedName: pt.normalizedName,
    createdAt: pt.createdAt.toISOString(),
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
    typeId: details.product.typeId ?? null,
    type: details.type ? toProductTypeDTO(details.type) : null,
    typeName: details.type?.name ?? null,
    categoryId: details.product.categoryId ?? null,
    category: details.category ? toCategoryDTO(details.category) : null,
    categoryName: details.category?.name ?? null,
    tags: details.tags ?? [],
    options: details.options ? details.options.map(toProductOptionDTO) : [],
    publishedAt: details.product.publishedAt
      ? details.product.publishedAt.toISOString()
      : null,
    lowStockThreshold: details.product.lowStockThreshold,
    maxOrderQuantity: details.product.maxOrderQuantity,
    ratingAverage: details.ratingAverage,
    ratingCount: details.ratingCount,
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
  typeId?: string | null;
  typeName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  tags?: string[];
  price?: number | null;
  compareAtPrice?: number | null;
  currency?: string | null;
  primaryMediaUrl?: string | null;
  primaryMediaAlt?: string | null;
  totalAvailableQuantity?: number;
  isOutOfStock?: boolean;
  isLowStock?: boolean;
  ratingAverage?: number | null;
  ratingCount?: number;
}): ProductSummaryDTO {
  return {
    id: item.product.id,
    storeId: item.product.storeId,
    title: item.product.title,
    slug: item.product.slug,
    status: item.product.status,
    typeId: item.typeId ?? item.product.typeId ?? null,
    typeName: item.typeName ?? null,
    categoryId: item.categoryId ?? item.product.categoryId ?? null,
    categoryName: item.categoryName ?? null,
    tags: item.tags ?? [],
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
    ratingAverage: item.ratingAverage,
    ratingCount: item.ratingCount,
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
        typeId: input.typeId ?? null,
        categoryId: input.categoryId ?? null,
        publishedAt,
        lowStockThreshold: input.lowStockThreshold ?? 5,
        maxOrderQuantity: input.maxOrderQuantity ?? null,
      });

      // 3. Assign tags if provided
      if (input.tags && input.tags.length > 0) {
        await this.repository.setProductTags(tx, storeId, productId, input.tags);
      }

      // 4. Assign options if provided
      if (input.options && input.options.length > 0) {
        await this.repository.setProductOptions(tx, storeId, productId, input.options);
      }

      // 5. Handle initial media if provided (inserted before variants so variants can reference media IDs)
      const mediaIds: string[] = [];
      if (input.media && input.media.length > 0) {
        for (let i = 0; i < input.media.length; i++) {
          const m = input.media[i]!;
          const mediaId = generateUuidV7();
          mediaIds.push(mediaId);
          await this.repository.insertMedia(tx, {
            id: mediaId,
            productId,
            storeId,
            url: m.url.trim(),
            altText: m.altText ?? null,
            position: m.position ?? i,
          });
        }
      }

      // 6. Handle variants
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

        const resolvedImageId =
          v.imageId ??
          (v.mediaIndex !== undefined && v.mediaIndex !== null
            ? mediaIds[v.mediaIndex] ?? null
            : null);

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
          status: v.status ?? "ACTIVE",
          option1: v.option1 ?? null,
          option2: v.option2 ?? null,
          option3: v.option3 ?? null,
          imageId: resolvedImageId,
          lowStockThreshold: v.lowStockThreshold ?? null,
          maxOrderQuantity: v.maxOrderQuantity ?? null,
          inventoryQuantity: v.inventoryQuantity,
        });
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
    const details = await this.repository.getProductWithDetails(
      client,
      storeId,
      product.id,
    );
    if (!details) {
      throw new ProductNotFoundError();
    }
    return toProductDetailDTO(details);
  }

  async listProducts(
    client: DatabaseClient,
    storeId: string,
    filters?: ListProductsFilterOptions,
  ): Promise<PaginatedResult<ProductSummaryDTO>> {
    const options: ListProductsOptions = {
      storeId,
      status: filters?.status,
      limit: filters?.limit,
      cursor: filters?.cursor,
      search: filters?.search,
      minPrice: filters?.minPrice,
      maxPrice: filters?.maxPrice,
      inStock: filters?.inStock,
      sortBy: filters?.sortBy,
      collectionId: filters?.collectionId,
      collectionSlug: filters?.collectionSlug,
      typeId: filters?.typeId,
      typeSlug: filters?.typeSlug,
      categoryId: filters?.categoryId,
      categorySlug: filters?.categorySlug,
      tags: filters?.tags,
    };

    const result = await this.repository.listProducts(client, options);

    return {
      items: result.items.map(toProductSummaryDTO),
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
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

      let slug: string | undefined;
      if (input.slug !== undefined) {
        slug = normalizeSlug(input.slug);
        if (!slug) {
          throw new Error("Product slug cannot be empty");
        }
        if (slug !== existing.slug) {
          const conflict = await this.repository.findProductBySlug(
            tx,
            storeId,
            slug,
          );
          if (conflict && conflict.id !== productId) {
            throw new DuplicateProductSlugError(slug);
          }
        }
      }

      let title: string | undefined;
      if (input.title !== undefined) {
        title = validateProductTitle(input.title);
      }

      await this.repository.updateProduct(tx, storeId, productId, {
        title,
        description: input.description,
        slug,
        typeId: input.typeId,
        categoryId: input.categoryId,
        lowStockThreshold: input.lowStockThreshold,
        maxOrderQuantity: input.maxOrderQuantity,
      });

      if (input.tags !== undefined) {
        await this.repository.setProductTags(tx, storeId, productId, input.tags);
      }

      if (input.options !== undefined) {
        await this.repository.setProductOptions(tx, storeId, productId, input.options);
      }

      const updated = await this.repository.getProductWithDetails(
        tx,
        storeId,
        productId,
      );
      return toProductDetailDTO(updated!);
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

  // --- Variants ---
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
        status: input.status ?? "ACTIVE",
        option1: input.option1 ?? null,
        option2: input.option2 ?? null,
        option3: input.option3 ?? null,
        imageId: input.imageId ?? null,
        lowStockThreshold: input.lowStockThreshold ?? null,
        maxOrderQuantity: input.maxOrderQuantity ?? null,
        inventoryQuantity: input.inventoryQuantity,
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
        option1?: string | null;
        option2?: string | null;
        option3?: string | null;
        imageId?: string | null;
        lowStockThreshold?: number | null;
        maxOrderQuantity?: number | null;
        inventoryQuantity?: number;
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
      if (input.option1 !== undefined) {
        updates.option1 = input.option1;
      }
      if (input.option2 !== undefined) {
        updates.option2 = input.option2;
      }
      if (input.option3 !== undefined) {
        updates.option3 = input.option3;
      }
      if (input.imageId !== undefined) {
        updates.imageId = input.imageId;
      }
      if (input.inventoryQuantity !== undefined) {
        updates.inventoryQuantity = input.inventoryQuantity;
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

  async batchUpdateVariants(
    db: Database,
    storeId: string,
    productId: string,
    updates: Array<{ id: string } & UpdateVariantInput>,
  ): Promise<ProductVariantDTO[]> {
    return await db.withTransaction(async (tx) => {
      const results = await this.repository.batchUpdateVariants(
        tx,
        storeId,
        productId,
        updates,
      );
      return results.map(toProductVariantDTO);
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
        variantId,
      );
      if (!existing) {
        throw new VariantNotFoundError();
      }

      const count = await this.repository.countActiveVariantsByProductId(
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

  // --- Product Options ---
  async setProductOptions(
    db: Database,
    storeId: string,
    productId: string,
    options: CreateProductOptionInput[],
  ): Promise<ProductOptionDTO[]> {
    return await db.withTransaction(async (tx) => {
      const product = await this.repository.findProductById(tx, storeId, productId);
      if (!product) {
        throw new ProductNotFoundError();
      }
      const opts = await this.repository.setProductOptions(tx, storeId, productId, options);
      return opts.map(toProductOptionDTO);
    });
  }

  async listProductOptions(
    client: DatabaseClient,
    storeId: string,
    productId: string,
  ): Promise<ProductOptionDTO[]> {
    const opts = await this.repository.listProductOptions(client, storeId, productId);
    return opts.map(toProductOptionDTO);
  }

  // --- Product Types (M1) ---
  async createProductType(
    db: Database,
    storeId: string,
    input: CreateProductTypeInput,
  ): Promise<ProductTypeDTO> {
    const name = input.name.trim();
    if (!name) throw new Error("Product type name cannot be empty");
    const slug = normalizeSlug(input.slug || name);

    return await db.withTransaction(async (tx) => {
      const existing = await this.repository.findProductTypeByName(tx, storeId, name);
      if (existing) {
        return toProductTypeDTO(existing);
      }
      const type = await this.repository.insertProductType(tx, {
        id: generateUuidV7(),
        storeId,
        name,
        slug,
      });
      return toProductTypeDTO(type);
    });
  }

  async listProductTypes(
    client: DatabaseClient,
    storeId: string,
  ): Promise<ProductTypeDTO[]> {
    const types = await this.repository.listProductTypes(client, storeId);
    return types.map(toProductTypeDTO);
  }

  async updateProductType(
    db: Database,
    storeId: string,
    typeId: string,
    input: UpdateProductTypeInput,
  ): Promise<ProductTypeDTO> {
    return await db.withTransaction(async (tx) => {
      const existing = await this.repository.findProductTypeById(tx, storeId, typeId);
      if (!existing) throw new Error("Product type not found");

      const name = input.name?.trim();
      const slug = input.slug ? normalizeSlug(input.slug) : name ? normalizeSlug(name) : undefined;

      const updated = await this.repository.updateProductType(tx, storeId, typeId, { name, slug });
      return toProductTypeDTO(updated!);
    });
  }

  async deleteProductType(
    db: Database,
    storeId: string,
    typeId: string,
  ): Promise<void> {
    await db.withTransaction(async (tx) => {
      await this.repository.deleteProductType(tx, storeId, typeId);
    });
  }

  // --- Categories (M1) ---
  async createCategory(
    db: Database,
    storeId: string,
    input: CreateCategoryInput,
  ): Promise<CategoryDTO> {
    const name = input.name.trim();
    if (!name) throw new Error("Category name cannot be empty");
    const slug = normalizeSlug(input.slug || name);

    return await db.withTransaction(async (tx) => {
      const existing = await this.repository.findCategoryBySlug(tx, storeId, slug);
      if (existing) {
        return toCategoryDTO(existing);
      }
      const cat = await this.repository.insertCategory(tx, {
        id: generateUuidV7(),
        storeId,
        name,
        slug,
        parentId: input.parentId ?? null,
        description: input.description ?? null,
        position: input.position ?? 0,
      });
      return toCategoryDTO(cat);
    });
  }

  async listCategories(
    client: DatabaseClient,
    storeId: string,
  ): Promise<CategoryDTO[]> {
    const cats = await this.repository.listCategories(client, storeId);
    return cats.map(toCategoryDTO);
  }

  async updateCategory(
    db: Database,
    storeId: string,
    categoryId: string,
    input: UpdateCategoryInput,
  ): Promise<CategoryDTO> {
    return await db.withTransaction(async (tx) => {
      const existing = await this.repository.findCategoryById(tx, storeId, categoryId);
      if (!existing) throw new Error("Category not found");

      const name = input.name?.trim();
      const slug = input.slug ? normalizeSlug(input.slug) : name ? normalizeSlug(name) : undefined;

      const updated = await this.repository.updateCategory(tx, storeId, categoryId, {
        name,
        slug,
        parentId: input.parentId,
        description: input.description,
        position: input.position,
      });
      return toCategoryDTO(updated!);
    });
  }

  async deleteCategory(
    db: Database,
    storeId: string,
    categoryId: string,
  ): Promise<void> {
    await db.withTransaction(async (tx) => {
      await this.repository.deleteCategory(tx, storeId, categoryId);
    });
  }

  // --- Product Tags (M1) ---
  async listTags(
    client: DatabaseClient,
    storeId: string,
  ): Promise<ProductTagDTO[]> {
    const tags = await this.repository.listTags(client, storeId);
    return tags.map(toProductTagDTO);
  }

  async setProductTags(
    db: Database,
    storeId: string,
    productId: string,
    tags: string[],
  ): Promise<string[]> {
    return await db.withTransaction(async (tx) => {
      return await this.repository.setProductTags(tx, storeId, productId, tags);
    });
  }

  // --- Media (M2) ---
  async addMedia(
    db: Database,
    storeId: string,
    productId: string,
    input: {
      url: string;
      altText?: string | null;
      position?: number;
      variantId?: string | null;
    },
  ): Promise<ProductMediaDTO> {
    return await db.withTransaction(async (tx) => {
      const product = await this.repository.findProductById(tx, storeId, productId);
      if (!product) throw new ProductNotFoundError();

      const existingMedia = await this.repository.listMediaByProductId(tx, productId);
      const nextPos = input.position ?? existingMedia.length;

      const media = await this.repository.insertMedia(tx, {
        id: generateUuidV7(),
        productId,
        storeId,
        variantId: input.variantId ?? null,
        url: input.url.trim(),
        altText: input.altText ?? null,
        position: nextPos,
      });
      return toProductMediaDTO(media);
    });
  }

  async deleteMedia(
    db: Database,
    storeId: string,
    productId: string,
    mediaId: string,
  ): Promise<void> {
    await db.withTransaction(async (tx) => {
      await this.repository.deleteMedia(tx, storeId, productId, mediaId);
    });
  }

  async reorderMedia(
    db: Database,
    storeId: string,
    productId: string,
    mediaIds: string[],
  ): Promise<void> {
    await db.withTransaction(async (tx) => {
      await this.repository.reorderMedia(tx, storeId, productId, mediaIds);
    });
  }
}
