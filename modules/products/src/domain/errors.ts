export class ProductDomainError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    message: string,
    code: string,
    status: number = 400,
    details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ProductNotFoundError extends ProductDomainError {
  constructor(message: string = "Product not found", details?: unknown) {
    super(message, "PRODUCT_NOT_FOUND", 404, details);
  }
}

export class DuplicateProductSlugError extends ProductDomainError {
  constructor(slug: string) {
    super(
      `Product slug '${slug}' is already in use in this store`,
      "PRODUCT_SLUG_CONFLICT",
      409,
      { slug },
    );
  }
}

export class DuplicateSkuError extends ProductDomainError {
  constructor(sku: string) {
    super(
      `SKU '${sku}' is already in use in this store`,
      "SKU_CONFLICT",
      409,
      { sku },
    );
  }
}

export class InvalidProductStateTransitionError extends ProductDomainError {
  constructor(fromStatus: string, toStatus: string) {
    super(
      `Cannot transition product from status '${fromStatus}' to '${toStatus}'`,
      "INVALID_PRODUCT_STATE",
      400,
      { fromStatus, toStatus },
    );
  }
}

export class ProductNotPublishableError extends ProductDomainError {
  constructor(message: string, details?: unknown) {
    super(message, "PRODUCT_NOT_PUBLISHABLE", 400, details);
  }
}

export class VariantNotFoundError extends ProductDomainError {
  constructor(message: string = "Product variant not found", details?: unknown) {
    super(message, "VARIANT_NOT_FOUND", 404, details);
  }
}

export class CannotDeleteLastVariantError extends ProductDomainError {
  constructor(message: string = "Cannot delete the only remaining variant of a product") {
    super(message, "CANNOT_DELETE_LAST_VARIANT", 400);
  }
}

export class InvalidPriceError extends ProductDomainError {
  constructor(message: string = "Price must be a non-negative integer in minor units") {
    super(message, "INVALID_PRICE", 400);
  }
}

export class ImmutableProductFieldError extends ProductDomainError {
  constructor(field: string) {
    super(
      `Field '${field}' is immutable and cannot be updated directly`,
      "IMMUTABLE_FIELD",
      400,
      { field },
    );
  }
}
