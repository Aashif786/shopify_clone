export class ShippingDomainError extends Error {
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

export class ShippingZoneNotFoundError extends ShippingDomainError {
  constructor(message: string = "Shipping zone not found", details?: unknown) {
    super(message, "SHIPPING_ZONE_NOT_FOUND", 404, details);
  }
}

export class ShippingRateNotFoundError extends ShippingDomainError {
  constructor(message: string = "Shipping rate not found", details?: unknown) {
    super(message, "SHIPPING_RATE_NOT_FOUND", 404, details);
  }
}

export class InvalidShippingZoneError extends ShippingDomainError {
  constructor(message: string = "Invalid shipping zone", details?: unknown) {
    super(message, "INVALID_SHIPPING_ZONE", 400, details);
  }
}

export class InvalidShippingRateError extends ShippingDomainError {
  constructor(message: string = "Invalid shipping rate", details?: unknown) {
    super(message, "INVALID_SHIPPING_RATE", 400, details);
  }
}

export class InvalidShippingWeightError extends ShippingDomainError {
  constructor(
    message: string = "Weight must be a whole number of grams, 0 or more",
    details?: unknown,
  ) {
    super(message, "INVALID_SHIPPING_WEIGHT", 400, details);
  }
}

/** The customer chose an option that is not on offer for this checkout. */
export class ShippingRateNotAvailableError extends ShippingDomainError {
  constructor(
    message: string = "That shipping option is not available for this order",
    details?: unknown,
  ) {
    super(message, "SHIPPING_RATE_NOT_AVAILABLE", 400, details);
  }
}

/**
 * Shipping is enabled for the store but the checkout has no valid, current
 * quote, so it cannot be paid. Raised by the payment guard.
 */
export class CheckoutShippingNotCurrentError extends ShippingDomainError {
  constructor(
    message: string = "Shipping has not been calculated for this checkout",
    details?: unknown,
  ) {
    super(message, "CHECKOUT_SHIPPING_NOT_CURRENT", 400, details);
  }
}
