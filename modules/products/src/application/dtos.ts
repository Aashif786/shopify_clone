import type { CollectionStatus, ProductStatus, VariantStatus } from "../domain/entities.js";

export type ProductSortBy =
  | "created_at_desc"
  | "created_at_asc"
  | "price_asc"
  | "price_desc"
  | "title_asc"
  | "title_desc";

export interface ListProductsFilterOptions {
  status?: ProductStatus;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: ProductSortBy;
  collectionId?: string;
  collectionSlug?: string;
  limit?: number;
  cursor?: string;
}

export interface CreateVariantNestedInput {
  title?: string;
  sku?: string | null;
  price: number;
  compareAtPrice?: number | null;
  position?: number;
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
  price?: number;
  compareAtPrice?: number | null;
  sku?: string | null;
  currency?: string;
  variants?: CreateVariantNestedInput[];
  media?: CreateMediaNestedInput[];
}

export interface UpdateProductInput {
  title?: string;
  description?: string | null;
  slug?: string;
}

export interface CreateVariantInput {
  title: string;
  sku?: string | null;
  price: number;
  compareAtPrice?: number | null;
  position?: number;
}

export interface UpdateVariantInput {
  title?: string;
  sku?: string | null;
  price?: number;
  compareAtPrice?: number | null;
  position?: number;
  status?: VariantStatus;
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
  publishedAt: string | null;
  variantsCount: number;
  mediaCount: number;
  price?: number | null;
  compareAtPrice?: number | null;
  currency?: string | null;
  primaryMediaUrl?: string | null;
  primaryMediaAlt?: string | null;
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
  publishedAt: string | null;
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

