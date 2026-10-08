import type { ProductStatus, VariantStatus } from "../domain/entities.js";

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
