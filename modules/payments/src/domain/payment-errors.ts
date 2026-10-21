export class PaymentDomainError extends Error {
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

export class PaymentNotFoundError extends PaymentDomainError {
  constructor(message: string = "Payment not found", details?: unknown) {
    super(message, "PAYMENT_NOT_FOUND", 404, details);
  }
}

export class PaymentAttemptNotFoundError extends PaymentDomainError {
  constructor(message: string = "Payment attempt not found", details?: unknown) {
    super(message, "PAYMENT_ATTEMPT_NOT_FOUND", 404, details);
  }
}

export class RefundNotFoundError extends PaymentDomainError {
  constructor(message: string = "Refund not found", details?: unknown) {
    super(message, "REFUND_NOT_FOUND", 404, details);
  }
}

export class CrossStorePaymentAccessError extends PaymentDomainError {
  constructor(
    message: string = "Payment does not belong to the authorized store",
    details?: unknown,
  ) {
    super(message, "CROSS_STORE_PAYMENT_ACCESS", 403, details);
  }
}

export class InvalidPaymentStateTransitionError extends PaymentDomainError {
  constructor(fromStatus: string, toStatus: string, details?: unknown) {
    super(
      `Invalid payment state transition from '${fromStatus}' to '${toStatus}'`,
      "INVALID_PAYMENT_STATE_TRANSITION",
      400,
      { fromStatus, toStatus, ...((details as object) ?? {}) },
    );
  }
}

export class InvalidPaymentAttemptStateTransitionError extends PaymentDomainError {
  constructor(fromStatus: string, toStatus: string, details?: unknown) {
    super(
      `Invalid payment attempt state transition from '${fromStatus}' to '${toStatus}'`,
      "INVALID_PAYMENT_ATTEMPT_STATE_TRANSITION",
      400,
      { fromStatus, toStatus, ...((details as object) ?? {}) },
    );
  }
}

export class InvalidRefundStateTransitionError extends PaymentDomainError {
  constructor(fromStatus: string, toStatus: string, details?: unknown) {
    super(
      `Invalid refund state transition from '${fromStatus}' to '${toStatus}'`,
      "INVALID_REFUND_STATE_TRANSITION",
      400,
      { fromStatus, toStatus, ...((details as object) ?? {}) },
    );
  }
}

export class PaymentNotRefundableError extends PaymentDomainError {
  constructor(
    message: string = "Payment is not in a refundable state (must be CAPTURED or PARTIALLY_REFUNDED)",
    details?: unknown,
  ) {
    super(message, "PAYMENT_NOT_REFUNDABLE", 400, details);
  }
}

export class InvalidMonetaryAmountError extends PaymentDomainError {
  constructor(
    message: string = "Payment amount must be a positive integer in minor currency units",
    details?: unknown,
  ) {
    super(message, "INVALID_MONETARY_AMOUNT", 400, details);
  }
}

export class InvalidCurrencyError extends PaymentDomainError {
  constructor(
    message: string = "Currency must be a 3-character uppercase ISO code",
    details?: unknown,
  ) {
    super(message, "INVALID_CURRENCY", 400, details);
  }
}

export class CapturedAmountExceedsPaymentAmountError extends PaymentDomainError {
  constructor(
    message: string = "Captured amount cannot exceed the payment amount",
    details?: unknown,
  ) {
    super(message, "CAPTURED_EXCEEDS_PAYMENT_AMOUNT", 400, details);
  }
}

export class RefundExceedsCapturedAmountError extends PaymentDomainError {
  constructor(
    message: string = "Refund amount exceeds the remaining refundable balance",
    details?: unknown,
  ) {
    super(message, "REFUND_EXCEEDS_CAPTURED_AMOUNT", 400, details);
  }
}

export class InvalidCheckoutStateForPaymentError extends PaymentDomainError {
  constructor(
    message: string = "Checkout is not eligible for payment creation",
    details?: unknown,
  ) {
    super(message, "INVALID_CHECKOUT_STATE_FOR_PAYMENT", 400, details);
  }
}

export class PaymentActiveConflictError extends PaymentDomainError {
  constructor(
    message: string = "An active payment already exists for this checkout",
    details?: unknown,
  ) {
    super(message, "PAYMENT_ACTIVE_CONFLICT", 409, details);
  }
}

export class PaymentIdempotencyConflictError extends PaymentDomainError {
  constructor(
    message: string = "Idempotency key has already been used with different request parameters",
    details?: unknown,
  ) {
    super(message, "PAYMENT_IDEMPOTENCY_CONFLICT", 409, details);
  }
}

export class ConcurrentOperationError extends PaymentDomainError {
  constructor(
    message: string = "A concurrent payment operation is currently in progress",
    details?: unknown,
  ) {
    super(message, "CONCURRENT_PAYMENT_OPERATION", 409, details);
  }
}

export class PaymentAmountMismatchError extends PaymentDomainError {
  constructor(
    message: string = "Payment amount does not match checkout total",
    details?: unknown,
  ) {
    super(message, "PAYMENT_AMOUNT_MISMATCH", 400, details);
  }
}

export class PaymentCurrencyMismatchError extends PaymentDomainError {
  constructor(
    message: string = "Payment currency does not match checkout currency",
    details?: unknown,
  ) {
    super(message, "PAYMENT_CURRENCY_MISMATCH", 400, details);
  }
}

export class PaymentValidationError extends PaymentDomainError {
  constructor(message: string, details?: unknown) {
    super(message, "PAYMENT_VALIDATION_ERROR", 400, details);
  }
}

export class PaymentGatewayError extends PaymentDomainError {
  constructor(message: string = "Payment gateway error", details?: unknown) {
    super(message, "PAYMENT_GATEWAY_NOT_CONFIGURED", 500, details);
  }
}

export class AmbiguousRefundPendingError extends PaymentDomainError {
  constructor(
    message: string = "Payment has a pending refund in REQUIRES_RECONCILIATION status. Resolve or reconcile before initiating another refund.",
    details?: unknown,
  ) {
    super(message, "AMBIGUOUS_REFUND_PENDING", 409, details);
  }
}
