export class ReturnDomainError extends Error {
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

export class ReturnRequestNotFoundError extends ReturnDomainError {
  constructor(message: string = "Return request not found", details?: unknown) {
    super(message, "RETURN_REQUEST_NOT_FOUND", 404, details);
  }
}

/**
 * Raised when a return request is addressed with a store it does not belong to.
 * Surfaced as 404 by the API layer to avoid confirming the existence of
 * another tenant's record.
 */
export class CrossStoreReturnAccessError extends ReturnDomainError {
  constructor(
    message: string = "Return request does not belong to the authorized store",
    details?: unknown,
  ) {
    super(message, "RETURN_ACCESS_DENIED", 403, details);
  }
}

export class InvalidReturnStatusTransitionError extends ReturnDomainError {
  constructor(fromStatus: string, toStatus: string, details?: unknown) {
    super(
      `Cannot transition return request from '${fromStatus}' to '${toStatus}'`,
      "INVALID_RETURN_STATUS_TRANSITION",
      400,
      details,
    );
  }
}

export class ReturnRequestImmutableError extends ReturnDomainError {
  constructor(
    message: string = "Return request is in a terminal state and can no longer be modified",
    details?: unknown,
  ) {
    super(message, "RETURN_REQUEST_IMMUTABLE", 400, details);
  }
}

export class ReturnAlreadyOpenError extends ReturnDomainError {
  constructor(
    message: string = "An open return request already exists for this order",
    details?: unknown,
  ) {
    super(message, "RETURN_ALREADY_OPEN", 409, details);
  }
}

export class OrderNotEligibleForReturnError extends ReturnDomainError {
  constructor(
    message: string = "This order is not eligible for a return",
    details?: unknown,
  ) {
    super(message, "ORDER_NOT_ELIGIBLE_FOR_RETURN", 400, details);
  }
}

export class ReturnWindowExpiredError extends ReturnDomainError {
  constructor(
    message: string = "The return window for this order has expired",
    details?: unknown,
  ) {
    super(message, "RETURN_WINDOW_EXPIRED", 400, details);
  }
}

export class ReturnsDisabledError extends ReturnDomainError {
  constructor(
    message: string = "This store does not accept returns",
    details?: unknown,
  ) {
    super(message, "RETURNS_DISABLED", 400, details);
  }
}

export class InvalidReturnItemsError extends ReturnDomainError {
  constructor(
    message: string = "Invalid return line items",
    details?: unknown,
  ) {
    super(message, "INVALID_RETURN_ITEMS", 400, details);
  }
}

export class ReturnQuantityExceededError extends ReturnDomainError {
  constructor(
    message: string = "Requested return quantity exceeds the quantity purchased",
    details?: unknown,
  ) {
    super(message, "RETURN_QUANTITY_EXCEEDED", 400, details);
  }
}

export class InvalidReturnPolicyError extends ReturnDomainError {
  constructor(message: string = "Invalid return policy", details?: unknown) {
    super(message, "INVALID_RETURN_POLICY", 400, details);
  }
}
