export class CartDomainError extends Error {
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

export class CartNotFoundError extends CartDomainError {
  constructor(message: string = "Cart not found", details?: unknown) {
    super(message, "CART_NOT_FOUND", 404, details);
  }
}

export class CartAccessDeniedError extends CartDomainError {
  constructor(message: string = "Access to cart is denied", details?: unknown) {
    super(message, "CART_ACCESS_DENIED", 403, details);
  }
}

export class CrossStoreCartAccessError extends CartDomainError {
  constructor(
    message: string = "Cart does not belong to the authorized store",
    details?: unknown,
  ) {
    super(message, "CART_ACCESS_DENIED", 403, details);
  }
}

export class CartNotActiveError extends CartDomainError {
  constructor(message: string = "Cart is not active", details?: unknown) {
    super(message, "CART_NOT_ACTIVE", 400, details);
  }
}

export class CartNotEditableError extends CartDomainError {
  constructor(
    message: string = "Cart is not in an editable state",
    details?: unknown,
  ) {
    super(message, "CART_NOT_EDITABLE", 400, details);
  }
}

export class CartAlreadyConvertedError extends CartDomainError {
  constructor(
    message: string = "Cart has already been converted and cannot be modified",
    details?: unknown,
  ) {
    super(message, "CART_ALREADY_CONVERTED", 400, details);
  }
}

export class CartExpiredError extends CartDomainError {
  constructor(
    message: string = "Cart has expired and cannot be modified",
    details?: unknown,
  ) {
    super(message, "CART_EXPIRED", 400, details);
  }
}

export class InvalidCartStatusError extends CartDomainError {
  constructor(message: string = "Invalid cart status", details?: unknown) {
    super(message, "INVALID_CART_STATUS", 400, details);
  }
}

export class InvalidCartStateTransitionError extends CartDomainError {
  constructor(fromStatus: string, toStatus: string) {
    super(
      `Cannot transition cart from status '${fromStatus}' to '${toStatus}'`,
      "INVALID_CART_STATUS",
      400,
      { fromStatus, toStatus },
    );
  }
}

export class CartItemNotFoundError extends CartDomainError {
  constructor(message: string = "Cart item not found", details?: unknown) {
    super(message, "CART_ITEM_NOT_FOUND", 404, details);
  }
}

export class InvalidQuantityError extends CartDomainError {
  constructor(message: string = "Invalid cart quantity", details?: unknown) {
    super(message, "INVALID_QUANTITY", 400, details);
  }
}

export class InvalidCurrencyError extends CartDomainError {
  constructor(message: string = "Invalid cart currency", details?: unknown) {
    super(message, "INVALID_CURRENCY", 400, details);
  }
}

export class DuplicateCartItemError extends CartDomainError {
  constructor(
    message: string = "Variant already exists in cart",
    details?: unknown,
  ) {
    super(message, "DUPLICATE_CART_ITEM", 409, details);
  }
}

export class ProductVariantNotFoundError extends CartDomainError {
  constructor(
    message: string = "Product variant not found",
    details?: unknown,
  ) {
    super(message, "PRODUCT_VARIANT_NOT_FOUND", 404, details);
  }
}

export class ProductVariantUnavailableError extends CartDomainError {
  constructor(
    message: string = "Product variant is unavailable for purchase",
    details?: unknown,
  ) {
    super(message, "PRODUCT_VARIANT_UNAVAILABLE", 400, details);
  }
}

export class CrossStoreVariantError extends CartDomainError {
  constructor(
    message: string = "Product variant does not belong to the cart's store",
    details?: unknown,
  ) {
    super(message, "CROSS_STORE_VARIANT", 400, details);
  }
}

export class CrossStoreCustomerError extends CartDomainError {
  constructor(
    message: string = "Customer does not belong to the cart's store",
    details?: unknown,
  ) {
    super(message, "CROSS_STORE_CUSTOMER", 400, details);
  }
}

export class CustomerNotFoundError extends CartDomainError {
  constructor(message: string = "Customer not found", details?: unknown) {
    super(message, "CUSTOMER_NOT_FOUND", 404, details);
  }
}


export class CartCheckoutInvalidError extends CartDomainError {
  constructor(
    message: string = "Cart is not eligible for checkout",
    details?: unknown,
  ) {
    super(message, "CART_CHECKOUT_INVALID", 400, details);
  }
}

export class InvalidCartPriceError extends CartDomainError {
  constructor(message: string = "Invalid cart price", details?: unknown) {
    super(message, "INVALID_PRICE", 400, details);
  }
}

export class InsufficientCartStockError extends CartDomainError {
  constructor(
    message: string = "Requested quantity exceeds available stock",
    details?: unknown,
  ) {
    super(message, "INSUFFICIENT_STOCK", 400, details);
  }
}

export class CartItemQuantityExceedsLimitError extends CartDomainError {
  constructor(
    message: string = "Requested quantity exceeds maximum order limit",
    details?: unknown,
  ) {
    super(message, "QUANTITY_LIMIT_EXCEEDED", 400, details);
  }
}
