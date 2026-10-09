export class OrderDomainError extends Error {
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

export const OrderBaseError = OrderDomainError;
export type OrderBaseError = OrderDomainError;

export class OrderNotFoundError extends OrderDomainError {
  constructor(orderId: string, storeId?: string, details?: unknown) {
    const msg = storeId
      ? `Order '${orderId}' not found in store '${storeId}'`
      : `Order '${orderId}' not found`;
    super(msg, "ORDER_NOT_FOUND", 404, { orderId, storeId, ...((details as object) ?? {}) });
  }
}

export class CrossStoreOrderAccessError extends OrderDomainError {
  constructor(message: string = "Cross-store order access denied", details?: unknown) {
    super(message, "CROSS_STORE_ORDER_ACCESS", 403, details);
  }
}

export class InvalidOrderStatusTransitionError extends OrderDomainError {
  constructor(fromStatus: string, toStatus: string, details?: unknown) {
    super(
      `Invalid order status transition from '${fromStatus}' to '${toStatus}'`,
      "INVALID_ORDER_STATUS_TRANSITION",
      400,
      { fromStatus, toStatus, ...((details as object) ?? {}) },
    );
  }
}

export class InvalidOrderStateError extends OrderDomainError {
  constructor(message: string, details?: unknown) {
    super(message, "INVALID_ORDER_STATE", 400, details);
  }
}

export class InvalidMonetaryAmountError extends OrderDomainError {
  constructor(message: string, details?: unknown) {
    super(message, "INVALID_MONETARY_AMOUNT", 400, details);
  }
}

export class InvalidCurrencyError extends OrderDomainError {
  constructor(message: string, details?: unknown) {
    super(message, "INVALID_CURRENCY", 400, details);
  }
}

export class InvalidQuantityError extends OrderDomainError {
  constructor(message: string, details?: unknown) {
    super(message, "INVALID_QUANTITY", 400, details);
  }
}

export class InvalidOrderItemError extends OrderDomainError {
  constructor(message: string, details?: unknown) {
    super(message, "INVALID_ORDER_ITEM", 400, details);
  }
}

export class InvalidOrderAddressError extends OrderDomainError {
  constructor(message: string, details?: unknown) {
    super(message, "INVALID_ORDER_ADDRESS", 400, details);
  }
}

export class OrderCancellationError extends OrderDomainError {
  constructor(message: string, details?: unknown) {
    super(message, "ORDER_CANCELLATION_ERROR", 400, details);
  }
}

export class OrderImmutableError extends OrderDomainError {
  constructor(message: string, details?: unknown) {
    super(message, "ORDER_IMMUTABLE", 400, details);
  }
}

export class OrderCompletionError extends OrderDomainError {
  constructor(message: string, details?: unknown) {
    super(message, "ORDER_COMPLETION_ERROR", 400, details);
  }
}

export class DuplicateOrderError extends OrderDomainError {
  constructor(message: string = "Order already exists for this checkout", details?: unknown) {
    super(message, "DUPLICATE_ORDER", 409, details);
  }
}

export class OrderTotalsMismatchError extends OrderDomainError {
  constructor(message: string, details?: unknown) {
    super(message, "ORDER_TOTALS_MISMATCH", 400, details);
  }
}

export class UnauthorizedPaymentStatusChangeError extends OrderDomainError {
  constructor(
    message: string = "Payment status cannot be modified without authorized internal payment path",
    details?: unknown,
  ) {
    super(message, "UNAUTHORIZED_PAYMENT_STATUS_CHANGE", 403, details);
  }
}
