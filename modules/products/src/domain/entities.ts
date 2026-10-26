export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type VariantStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type CollectionStatus = "ACTIVE" | "ARCHIVED";

export interface ProductType {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  storeId: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductTag {
  id: string;
  storeId: string;
  name: string;
  normalizedName: string;
  createdAt: Date;
}

export interface ProductTagAssignment {
  productId: string;
  tagId: string;
  storeId: string;
  createdAt: Date;
}

export interface ProductOption {
  id: string;
  storeId: string;
  productId: string;
  name: string;
  position: number;
  values: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  storeId: string;
  title: string;
  description: string | null;
  slug: string;
  status: ProductStatus;
  typeId?: string | null;
  categoryId?: string | null;
  publishedAt: Date | null;
  lowStockThreshold: number;
  maxOrderQuantity: number | null;
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
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  imageId?: string | null;
  imageUrl?: string | null;
  inventoryQuantity?: number;
  lowStockThreshold: number | null;
  maxOrderQuantity: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductMedia {
  id: string;
  productId: string;
  variantId: string | null;
  storeId?: string | null;
  url: string;
  altText: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductWithDetails {
  product: Product;
  variants: ProductVariant[];
  options?: ProductOption[];
  media: ProductMedia[];
  tags?: string[];
  type?: ProductType | null;
  category?: Category | null;
}

export interface Collection {
  id: string;
  storeId: string;
  title: string;
  slug: string;
  description: string | null;
  status: CollectionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectionProduct {
  collectionId: string;
  productId: string;
  storeId: string;
  position: number;
  createdAt: Date;
}

export interface CollectionWithProductCount extends Collection {
  productCount: number;
}
