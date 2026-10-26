export {
  type ProductStatus,
  type VariantStatus,
  type CollectionStatus,
  type Product,
  type ProductVariant,
  type ProductMedia,
  type ProductWithDetails,
  type Collection,
  type CollectionProduct,
  type CollectionWithProductCount,
  type ProductType,
  type Category,
  type ProductTag,
  type ProductTagAssignment,
  type ProductOption,
  type ReviewStatus,
  type ProductReview,
  type ReviewModerationLog,
  type ReviewReport,
  type ReviewRatingDistribution,
  type ProductReviewSummary,
} from "./domain/entities.js";

export {
  ProductDomainError,
  ProductNotFoundError,
  DuplicateProductSlugError,
  DuplicateSkuError,
  InvalidProductStateTransitionError,
  ProductNotPublishableError,
  VariantNotFoundError,
  CannotDeleteLastVariantError,
  InvalidPriceError,
  ImmutableProductFieldError,
  CollectionNotFoundError,
  DuplicateCollectionSlugError,
  InvalidCollectionStateTransitionError,
  ReviewNotFoundError,
  DuplicateReviewError,
  ReviewEligibilityError,
  InvalidRatingError,
  ReviewForbiddenError,
  ReviewReportError,
} from "./domain/errors.js";

export {
  isValidProductTransition,
  assertValidProductTransition,
  isValidVariantTransition,
  assertValidVariantTransition,
} from "./domain/lifecycle.js";

export {
  normalizeSlug,
  isValidSlugFormat,
  validateProductTitle,
  validatePrice,
  validateCompareAtPrice,
  validateSku,
  validateProductPublishable,
} from "./domain/validation.js";

export {
  generateVariantCombinations,
  type OptionDefinition,
  type GeneratedVariantCombination,
} from "./domain/combinations.js";

export {
  ProductRepository,
  type ListProductsOptions,
  type ListProductsResult,
  type ProductSortBy,
} from "./infrastructure/product-repository.js";

export {
  CollectionRepository,
  type ListCollectionsOptions,
} from "./infrastructure/collection-repository.js";

export { ProductService } from "./application/product-service.js";
export { CollectionService } from "./application/collection-service.js";
export { ReviewService } from "./application/review-service.js";
export { ReviewRepository } from "./infrastructure/review-repository.js";

export type {
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
  CreateVariantNestedInput,
  CreateMediaNestedInput,
  ProductVariantDTO,
  ProductMediaDTO,
  ProductSummaryDTO,
  ProductDetailDTO,
  ProductSortBy as ProductSortOption,
  ListProductsFilterOptions,
  CollectionDTO,
  CreateCollectionInput,
  UpdateCollectionInput,
  ProductTypeDTO,
  CategoryDTO,
  ProductTagDTO,
  CreateProductTypeInput,
  UpdateProductTypeInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  ProductOptionDTO,
  CreateProductOptionInput,
  ReviewSortBy,
  ProductReviewDTO,
  MerchantReviewDTO,
  ReviewModerationLogDTO,
  ReviewRatingDistributionDTO,
  ProductReviewSummaryDTO,
  CreateReviewInput,
  UpdateReviewInput,
  ModerateReviewInput,
  ReviewReportInput,
  ReviewEligibilityDTO,
  ListPublishedReviewsFilterOptions,
  ListMerchantReviewsFilterOptions,
  MerchantReviewStatsDTO,
} from "./application/dtos.js";

