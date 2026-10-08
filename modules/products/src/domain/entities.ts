export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type VariantStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export interface Product {
  id: string;
  storeId: string;
  title: string;
  description: string | null;
  slug: string;
  status: ProductStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductVariant {
  id: string;
  productId: string;
  storeId: string;
  title: string;
  sku: string | null;
  price: number; // Integer minor units (e.g. cents)
  compareAtPrice: number | null;
  currency: string;
  position: number;
  status: VariantStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductMedia {
  id: string;
  productId: string;
  variantId: string | null;
  url: string;
  altText: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductWithDetails {
  product: Product;
  variants: ProductVariant[];
  media: ProductMedia[];
}
