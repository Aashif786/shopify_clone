import type { CollectionStatus, ProductStatus, VariantStatus } from "../domain/entities.js";

export type ProductSortBy =
  | "created_at_desc"
  | "created_at_asc"
  | "price_asc"
  | "price_desc"
  | "title_asc"
  | "title_desc";

export interface ProductTypeDTO {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductTypeInput {
  name: string;
  slug?: string;
}

export interface UpdateProductTypeInput {
  name?: string;
  slug?: string;
}

export interface CategoryDTO {
  id: string;
  storeId: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryInput {
  name: string;
  slug?: string;
  parentId?: string | null;
  description?: string | null;
  position?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  parentId?: string | null;
  description?: string | null;
  position?: number;
}

export interface ProductTagDTO {
  id: string;
  storeId: string;
  name: string;
  normalizedName: string;
  createdAt: string;
}

export interface ProductOptionDTO {
  id: string;
  productId: string;
  name: string;
  position: number;
  values: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProductOptionInput {
  name: string;
  position?: number;
  values: string[];
}

export interface ListProductsFilterOptions {
  status?: ProductStatus;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: ProductSortBy;
  collectionId?: string;
  collectionSlug?: string;
  typeId?: string;
  typeSlug?: string;
  categoryId?: string;
  categorySlug?: string;
  tags?: string[];
  limit?: number;
  cursor?: string;
}

export interface CreateVariantNestedInput {
  title?: string;
  sku?: string | null;
  price: number;
  compareAtPrice?: number | null;
  position?: number;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  imageId?: string | null;
  mediaIndex?: number | null;
  status?: VariantStatus;
  lowStockThreshold?: number | null;
  maxOrderQuantity?: number | null;
  inventoryQuantity?: number;
}

export interface CreateMediaNestedInput {
  url: string;
  altText?: string | null;
  position?: number;
}

export interface CreateProductInput {
  title: string;
  description?: string | null;
  slug?: string;
  status?: ProductStatus;
  typeId?: string | null;
  categoryId?: string | null;
  tags?: string[];
  price?: number;
  compareAtPrice?: number | null;
  sku?: string | null;
  currency?: string;
  lowStockThreshold?: number;
  maxOrderQuantity?: number | null;
  options?: CreateProductOptionInput[];
  variants?: CreateVariantNestedInput[];
  media?: CreateMediaNestedInput[];
}

export interface UpdateProductInput {
  title?: string;
  description?: string | null;
  slug?: string;
  typeId?: string | null;
  categoryId?: string | null;
  tags?: string[];
  lowStockThreshold?: number;
  maxOrderQuantity?: number | null;
  options?: CreateProductOptionInput[];
  variants?: CreateVariantNestedInput[];
}

export interface CreateVariantInput {
  title: string;
  sku?: string | null;
  price: number;
  compareAtPrice?: number | null;
  position?: number;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  imageId?: string | null;
  mediaIndex?: number | null;
  status?: VariantStatus;
  lowStockThreshold?: number | null;
  maxOrderQuantity?: number | null;
  inventoryQuantity?: number;
}

export interface UpdateVariantInput {
  title?: string;
  sku?: string | null;
  price?: number;
  compareAtPrice?: number | null;
  position?: number;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  imageId?: string | null;
  mediaIndex?: number | null;
  status?: VariantStatus;
  lowStockThreshold?: number | null;
  maxOrderQuantity?: number | null;
  inventoryQuantity?: number;
}

export interface ProductVariantDTO {
  id: string;
  productId: string;
  title: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  position: number;
  status: VariantStatus;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  imageId?: string | null;
  imageUrl?: string | null;
  inventoryQuantity?: number;
  lowStockThreshold: number | null;
  maxOrderQuantity: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductMediaDTO {
  id: string;
  productId: string;
  variantId: string | null;
  url: string;
  altText: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSummaryDTO {
  id: string;
  storeId: string;
  title: string;
  slug: string;
  status: ProductStatus;
  typeId?: string | null;
  typeName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  tags?: string[];
  options?: ProductOptionDTO[];
  publishedAt: string | null;
  variantsCount: number;
  mediaCount: number;
  price?: number | null;
  compareAtPrice?: number | null;
  currency?: string | null;
  primaryMediaUrl?: string | null;
  primaryMediaAlt?: string | null;
  lowStockThreshold: number;
  maxOrderQuantity: number | null;
  totalAvailableQuantity?: number;
  isOutOfStock?: boolean;
  isLowStock?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDetailDTO {
  id: string;
  storeId: string;
  title: string;
  description: string | null;
  slug: string;
  status: ProductStatus;
  typeId?: string | null;
  type?: ProductTypeDTO | null;
  typeName?: string | null;
  categoryId?: string | null;
  category?: CategoryDTO | null;
  categoryName?: string | null;
  tags?: string[];
  options?: ProductOptionDTO[];
  publishedAt: string | null;
  lowStockThreshold: number;
  maxOrderQuantity: number | null;
  variants: ProductVariantDTO[];
  media: ProductMediaDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface CollectionDTO {
  id: string;
  storeId: string;
  title: string;
  slug: string;
  description: string | null;
  status: CollectionStatus;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionInput {
  title: string;
  slug?: string;
  description?: string | null;
  status?: CollectionStatus;
}

export interface UpdateCollectionInput {
  title?: string;
  slug?: string;
  description?: string | null;
  status?: CollectionStatus;
}
