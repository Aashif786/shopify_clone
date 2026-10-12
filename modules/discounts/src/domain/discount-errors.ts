export class DiscountDomainError extends Error {
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

export class DiscountNotFoundError extends DiscountDomainError {
  constructor(message: string = "Discount not found", details?: unknown) {
    super(message, "DISCOUNT_NOT_FOUND", 404, details);
  }
}

export class DiscountAlreadyExistsError extends DiscountDomainError {
  constructor(message: string = "Discount code already exists for this store", details?: unknown) {
    super(message, "DISCOUNT_ALREADY_EXISTS", 409, details);
  }
}

export class CrossStoreDiscountAccessError extends DiscountDomainError {
  constructor(
    message: string = "Discount does not belong to the authorized store",
    details?: unknown,
  ) {
    super(message, "DISCOUNT_ACCESS_DENIED", 403, details);
  }
}

export class DiscountInactiveError extends DiscountDomainError {
  constructor(message: string = "Discount code is currently inactive", details?: unknown) {
    super(message, "DISCOUNT_INACTIVE", 400, details);
  }
}

export class DiscountExpiredError extends DiscountDomainError {
  constructor(message: string = "Discount code has expired", details?: unknown) {
    super(message, "DISCOUNT_EXPIRED", 400, details);
  }
}

export class DiscountMinimumSpendNotMetError extends DiscountDomainError {
  constructor(message: string = "Minimum order amount not met for this discount", details?: unknown) {
    super(message, "MINIMUM_AMOUNT_NOT_MET", 400, details);
  }
}

export class DiscountUsageLimitExceededError extends DiscountDomainError {
  constructor(message: string = "Discount usage limit has been reached", details?: unknown) {
    super(message, "USAGE_LIMIT_REACHED", 400, details);
  }
}

export class DiscountCurrencyMismatchError extends DiscountDomainError {
  constructor(message: string = "Discount currency does not match order currency", details?: unknown) {
    super(message, "CURRENCY_MISMATCH", 400, details);
  }
}

export class InvalidDiscountCodeError extends DiscountDomainError {
  constructor(message: string = "Invalid discount code", details?: unknown) {
    super(message, "INVALID_DISCOUNT_CODE", 400, details);
  }
}

export class InvalidDiscountValueError extends DiscountDomainError {
  constructor(message: string = "Invalid discount value", details?: unknown) {
    super(message, "INVALID_DISCOUNT_VALUE", 400, details);
  }
}

export class DiscountRedemptionNotFoundError extends DiscountDomainError {
  constructor(message: string = "Discount redemption not found", details?: unknown) {
    super(message, "DISCOUNT_REDEMPTION_NOT_FOUND", 404, details);
  }
}
