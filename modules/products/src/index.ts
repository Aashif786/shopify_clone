export {
  type ProductStatus,
  type VariantStatus,
  type Product,
  type ProductVariant,
  type ProductMedia,
  type ProductWithDetails,
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
  ProductRepository,
  type ListProductsOptions,
  type ListProductsResult,
} from "./infrastructure/product-repository.js";

export { ProductService } from "./application/product-service.js";

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
} from "./application/dtos.js";
