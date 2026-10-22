export class CheckoutDomainError extends Error {
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

export class CheckoutNotFoundError extends CheckoutDomainError {
  constructor(message: string = "Checkout not found", details?: unknown) {
    super(message, "CHECKOUT_NOT_FOUND", 404, details);
  }
}

export class CheckoutAccessDeniedError extends CheckoutDomainError {
  constructor(message: string = "Access to checkout is denied", details?: unknown) {
    super(message, "CHECKOUT_ACCESS_DENIED", 403, details);
  }
}

export class CrossStoreCheckoutAccessError extends CheckoutDomainError {
  constructor(
    message: string = "Checkout does not belong to the authorized store",
    details?: unknown,
  ) {
    super(message, "CHECKOUT_ACCESS_DENIED", 403, details);
  }
}

export class CrossStoreCartError extends CheckoutDomainError {
  constructor(
    message: string = "Cart does not belong to the checkout store",
    details?: unknown,
  ) {
    super(message, "CROSS_STORE_CART", 400, details);
  }
}

export class CrossStoreCustomerError extends CheckoutDomainError {
  constructor(
    message: string = "Customer does not belong to the checkout store",
    details?: unknown,
  ) {
    super(message, "CROSS_STORE_CUSTOMER", 400, details);
  }
}

export class CrossStoreVariantError extends CheckoutDomainError {
  constructor(
    message: string = "Product variant does not belong to the checkout store",
    details?: unknown,
  ) {
    super(message, "CROSS_STORE_VARIANT", 400, details);
  }
}

export class CheckoutNotActiveError extends CheckoutDomainError {
  constructor(message: string = "Checkout is not active", details?: unknown) {
    super(message, "CHECKOUT_NOT_ACTIVE", 400, details);
  }
}

export class CheckoutNotEditableError extends CheckoutDomainError {
  constructor(
    message: string = "Checkout is not in an editable state",
    details?: unknown,
  ) {
    super(message, "CHECKOUT_NOT_EDITABLE", 400, details);
  }
}

export class CheckoutAlreadyCompletedError extends CheckoutDomainError {
  constructor(
    message: string = "Checkout has already been completed and cannot be modified",
    details?: unknown,
  ) {
    super(message, "CHECKOUT_ALREADY_COMPLETED", 400, details);
  }
}

export class CheckoutExpiredError extends CheckoutDomainError {
  constructor(
    message: string = "Checkout has expired and cannot be modified",
    details?: unknown,
  ) {
    super(message, "CHECKOUT_EXPIRED", 400, details);
  }
}

export class InvalidCheckoutStatusError extends CheckoutDomainError {
  constructor(message: string = "Invalid checkout status", details?: unknown) {
    super(message, "INVALID_CHECKOUT_STATUS", 400, details);
  }
}

export class InvalidCheckoutStateTransitionError extends CheckoutDomainError {
  constructor(fromStatus: string, toStatus: string) {
    super(
      `Cannot transition checkout from status '${fromStatus}' to '${toStatus}'`,
      "INVALID_CHECKOUT_STATUS",
      400,
      { fromStatus, toStatus },
    );
  }
}

export class CheckoutItemNotFoundError extends CheckoutDomainError {
  constructor(message: string = "Checkout item not found", details?: unknown) {
    super(message, "CHECKOUT_ITEM_NOT_FOUND", 404, details);
  }
}

export class DuplicateCheckoutItemError extends CheckoutDomainError {
  constructor(
    message: string = "Item for this variant already exists in checkout",
    details?: unknown,
  ) {
    super(message, "DUPLICATE_CHECKOUT_ITEM", 400, details);
  }
}

export class InvalidCheckoutItemError extends CheckoutDomainError {
  constructor(message: string = "Invalid checkout item", details?: unknown) {
    super(message, "INVALID_CHECKOUT_ITEM", 400, details);
  }
}

export class InvalidQuantityError extends CheckoutDomainError {
  constructor(message: string = "Invalid checkout quantity", details?: unknown) {
    super(message, "INVALID_QUANTITY", 400, details);
  }
}

export { InvalidQuantityError as InvalidCheckoutQuantityError };

export class InvalidCheckoutPriceError extends CheckoutDomainError {
  constructor(message: string = "Invalid monetary amount", details?: unknown) {
    super(message, "INVALID_PRICE", 400, details);
  }
}

export class InvalidCurrencyError extends CheckoutDomainError {
  constructor(message: string = "Invalid currency code", details?: unknown) {
    super(message, "INVALID_CURRENCY", 400, details);
  }
}

export { InvalidCurrencyError as InvalidCheckoutCurrencyError };

export class InvalidCheckoutAddressError extends CheckoutDomainError {
  constructor(message: string = "Invalid checkout address", details?: unknown) {
    super(message, "INVALID_CHECKOUT_ADDRESS", 400, details);
  }
}

export class EmptyCheckoutError extends CheckoutDomainError {
  constructor(message: string = "Checkout must have at least one item", details?: unknown) {
    super(message, "EMPTY_CHECKOUT", 400, details);
  }
}

export class IdempotencyConflictError extends CheckoutDomainError {
  constructor(
    message: string = "Idempotency key has already been used with different parameters",
    details?: unknown,
  ) {
    super(message, "IDEMPOTENCY_CONFLICT", 409, details);
  }
}

export class CustomerNotFoundError extends CheckoutDomainError {
  constructor(message: string = "Customer not found", details?: unknown) {
    super(message, "CUSTOMER_NOT_FOUND", 404, details);
  }
}

export class ProductVariantNotFoundError extends CheckoutDomainError {
  constructor(message: string = "Product variant not found", details?: unknown) {
    super(message, "PRODUCT_NOT_FOUND", 404, details);
  }
}

export class ProductVariantUnavailableError extends CheckoutDomainError {
  constructor(message: string = "Product variant is unavailable for purchase", details?: unknown) {
    super(message, "PRODUCT_UNAVAILABLE", 400, details);
  }
}

export class CartNotFoundError extends CheckoutDomainError {
  constructor(message: string = "Cart not found", details?: unknown) {
    super(message, "CART_NOT_FOUND", 404, details);
  }
}

export class CartNotActiveError extends CheckoutDomainError {
  constructor(message: string = "Cart is not active and cannot be checked out", details?: unknown) {
    super(message, "CART_NOT_ACTIVE", 400, details);
  }
}

export class EmptyCartError extends CheckoutDomainError {
  constructor(message: string = "Cannot checkout an empty cart", details?: unknown) {
    super(message, "EMPTY_CART", 400, details);
  }
}

export class InsufficientStockError extends CheckoutDomainError {
  constructor(
    message: string = "Requested quantity exceeds available stock",
    details?: unknown,
  ) {
    super(message, "INSUFFICIENT_STOCK", 400, details);
  }
}

export class QuantityLimitExceededError extends CheckoutDomainError {
  constructor(
    message: string = "Requested quantity exceeds maximum order limit",
    details?: unknown,
  ) {
    super(message, "QUANTITY_LIMIT_EXCEEDED", 400, details);
  }
}
