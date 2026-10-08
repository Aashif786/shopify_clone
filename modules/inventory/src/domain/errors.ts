export class InventoryDomainError extends Error {
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

export class InventoryNotFoundError extends InventoryDomainError {
  constructor(message: string = "Inventory item not found", details?: unknown) {
    super(message, "INVENTORY_NOT_FOUND", 404, details);
  }
}

export class ReservationNotFoundError extends InventoryDomainError {
  constructor(message: string = "Inventory reservation not found", details?: unknown) {
    super(message, "RESERVATION_NOT_FOUND", 404, details);
  }
}

export class InvalidInventoryQuantityError extends InventoryDomainError {
  constructor(message: string = "Inventory quantity must be a non-negative integer", details?: unknown) {
    super(message, "INVALID_INVENTORY_QUANTITY", 400, details);
  }
}

export class InsufficientStockError extends InventoryDomainError {
  constructor(
    message: string = "Insufficient available inventory to satisfy request",
    details?: unknown,
  ) {
    super(message, "INSUFFICIENT_INVENTORY", 409, details);
  }
}

export class InvalidReservationStateTransitionError extends InventoryDomainError {
  constructor(fromStatus: string, toStatus: string) {
    super(
      `Cannot transition reservation from status '${fromStatus}' to '${toStatus}'`,
      "INVALID_RESERVATION_STATE",
      400,
      { fromStatus, toStatus },
    );
  }
}

export class InvalidAdjustmentReasonError extends InventoryDomainError {
  constructor(reason: unknown) {
    super(
      `Invalid adjustment reason '${String(reason)}'`,
      "INVALID_ADJUSTMENT_REASON",
      400,
      { reason },
    );
  }
}

export class CrossStoreInventoryAccessError extends InventoryDomainError {
  constructor(message: string = "Cross-store inventory access is forbidden") {
    super(message, "CROSS_STORE_INVENTORY_ACCESS", 403);
  }
}

export class DuplicateReservationError extends InventoryDomainError {
  constructor(message: string = "Reservation already exists for this reference") {
    super(message, "RESERVATION_CONFLICT", 409);
  }
}
