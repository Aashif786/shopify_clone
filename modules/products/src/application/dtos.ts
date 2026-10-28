import type { CollectionStatus, ProductStatus, ReviewStatus, VariantStatus } from "../domain/entities.js";

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

export interface ProductOptionValueDTO {
  id: string;
  optionId: string;
  value: string;
  displayTitle: string | null;
  isPublished: boolean;
  position: number;
  mediaIds?: string[];
  media?: ProductMediaDTO[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProductOptionValueInput {
  value: string;
  displayTitle?: string | null;
  isPublished?: boolean;
  position?: number;
  mediaIds?: string[];
  mediaIndexes?: number[];
}

export interface ProductOptionDTO {
  id: string;
  productId: string;
  name: string;
  position: number;
  values: string[];
  isPublishable?: boolean;
  optionValues?: ProductOptionValueDTO[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProductOptionInput {
  name: string;
  position?: number;
  values: string[];
  isPublishable?: boolean;
  optionValues?: CreateProductOptionValueInput[];
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
  includeStandaloneVariants?: boolean;
}

export interface CreateVariantNestedInput {
  title?: string;
  displayTitle?: string | null;
  publishedAsProduct?: boolean;
  sku?: string | null;
  price: number;
  compareAtPrice?: number | null;
  position?: number;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  imageId?: string | null;
  mediaIndex?: number | null;
  mediaIndexes?: number[];
  mediaIds?: string[];
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
  status?: ProductStatus;
  typeId?: string | null;
  categoryId?: string | null;
  tags?: string[];
  lowStockThreshold?: number;
  maxOrderQuantity?: number | null;
  options?: CreateProductOptionInput[];
  variants?: Array<CreateVariantNestedInput & { id?: string }>;
  media?: Array<{ id?: string; url: string; altText?: string | null; position?: number }>;
}

export interface CreateVariantInput {
  title: string;
  displayTitle?: string | null;
  publishedAsProduct?: boolean;
  sku?: string | null;
  price: number;
  compareAtPrice?: number | null;
  position?: number;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  imageId?: string | null;
  mediaIndex?: number | null;
  mediaIndexes?: number[];
  mediaIds?: string[];
  status?: VariantStatus;
  lowStockThreshold?: number | null;
  maxOrderQuantity?: number | null;
  inventoryQuantity?: number;
}

export interface UpdateVariantInput {
  title?: string;
  displayTitle?: string | null;
  publishedAsProduct?: boolean;
  sku?: string | null;
  price?: number;
  compareAtPrice?: number | null;
  position?: number;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  imageId?: string | null;
  mediaIndex?: number | null;
  mediaIndexes?: number[];
  mediaIds?: string[];
  status?: VariantStatus;
  lowStockThreshold?: number | null;
  maxOrderQuantity?: number | null;
  inventoryQuantity?: number;
}

export interface ProductVariantDTO {
  id: string;
  productId: string;
  title: string;
  displayTitle?: string | null;
  publishedAsProduct?: boolean;
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
  mediaIds?: string[];
  media?: ProductMediaDTO[];
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
  ratingAverage?: number | null;
  ratingCount?: number;
  createdAt: string;
  updatedAt: string;
  variantId?: string | null;
  isStandaloneVariant?: boolean;
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
  ratingAverage?: number | null;
  ratingCount?: number;
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


export type ReviewSortBy = "newest" | "oldest" | "highest_rated" | "lowest_rated";

export interface ProductReviewDTO {
  id: string;
  storeId: string;
  productId: string;
  customerId: string | null;
  orderId: string | null;
  variantId: string | null;
  variantTitle?: string | null;
  rating: number;
  title: string;
  content: string;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  customerName: string;
  merchantReply: string | null;
  merchantReplyAt: string | null;
  reportCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantReviewDTO extends ProductReviewDTO {
  customerEmail: string | null;
  productTitle: string;
  productSlug: string;
  moderatedAt: string | null;
  moderatedByUserId: string | null;
  moderationReason: string | null;
  moderationLogs?: ReviewModerationLogDTO[];
}

export interface ReviewModerationLogDTO {
  id: string;
  reviewId: string;
  userId: string | null;
  previousStatus: ReviewStatus;
  newStatus: ReviewStatus;
  reason: string | null;
  createdAt: string;
}

export interface ReviewRatingDistributionDTO {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface ProductReviewSummaryDTO {
  averageRating: number;
  totalReviews: number;
  distribution: ReviewRatingDistributionDTO;
}

export interface CreateReviewInput {
  rating: number;
  title: string;
  content: string;
  orderId?: string | null;
  variantId?: string | null;
}

export interface UpdateReviewInput {
  rating?: number;
  title?: string;
  content?: string;
}

export interface ModerateReviewInput {
  status: ReviewStatus;
  reason?: string | null;
}

export interface ReviewReportInput {
  reason: string;
  details?: string | null;
}

export interface ReviewEligibilityDTO {
  canReview: boolean;
  isVerified: boolean;
  eligibleOrderId: string | null;
  eligibleVariantId: string | null;
  existingReview: ProductReviewDTO | null;
  message?: string;
  isAuthenticated?: boolean;
}

export interface ListPublishedReviewsFilterOptions {
  page?: number;
  limit?: number;
  sortBy?: ReviewSortBy;
  rating?: number;
}

export interface ListMerchantReviewsFilterOptions {
  productId?: string;
  status?: ReviewStatus;
  rating?: number;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: ReviewSortBy;
}

export interface MerchantReviewStatsDTO {
  total: number;
  pending: number;
  published: number;
  rejected: number;
  hidden: number;
}
