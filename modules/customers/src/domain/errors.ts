export class CustomerDomainError extends Error {
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

export class CustomerNotFoundError extends CustomerDomainError {
  constructor(message: string = "Customer not found", details?: unknown) {
    super(message, "CUSTOMER_NOT_FOUND", 404, details);
  }
}

export class CustomerAccessDeniedError extends CustomerDomainError {
  constructor(
    message: string = "Access to customer is denied",
    details?: unknown,
  ) {
    super(message, "CUSTOMER_ACCESS_DENIED", 403, details);
  }
}

export class CrossStoreCustomerAccessError extends CustomerDomainError {
  constructor(
    message: string = "Customer does not belong to the authorized store",
    details?: unknown,
  ) {
    super(message, "CUSTOMER_ACCESS_DENIED", 403, details);
  }
}

export class DuplicateCustomerError extends CustomerDomainError {
  constructor(
    message: string = "Customer already exists in this store",
    details?: unknown,
  ) {
    super(message, "CUSTOMER_ALREADY_EXISTS", 409, details);
  }
}

export class CustomerAlreadyExistsError extends CustomerDomainError {
  constructor(
    message: string = "Customer with this email already exists in this store",
    details?: unknown,
  ) {
    super(message, "CUSTOMER_ALREADY_EXISTS", 409, details);
  }
}

export class InvalidCustomerEmailError extends CustomerDomainError {
  constructor(message: string = "Invalid customer email address format", details?: unknown) {
    super(message, "INVALID_CUSTOMER_EMAIL", 400, details);
  }
}

export class InvalidCustomerStatusError extends CustomerDomainError {
  constructor(message: string = "Invalid customer status", details?: unknown) {
    super(message, "INVALID_CUSTOMER_STATUS", 400, details);
  }
}

export class InvalidCustomerStateTransitionError extends CustomerDomainError {
  constructor(fromStatus: string, toStatus: string) {
    super(
      `Cannot transition customer from status '${fromStatus}' to '${toStatus}'`,
      "INVALID_CUSTOMER_STATUS",
      400,
      { fromStatus, toStatus },
    );
  }
}

export class AddressNotFoundError extends CustomerDomainError {
  constructor(message: string = "Address not found", details?: unknown) {
    super(message, "ADDRESS_NOT_FOUND", 404, details);
  }
}

export class AddressAccessDeniedError extends CustomerDomainError {
  constructor(
    message: string = "Access to address is denied",
    details?: unknown,
  ) {
    super(message, "ADDRESS_ACCESS_DENIED", 403, details);
  }
}

export class CrossStoreAddressAccessError extends CustomerDomainError {
  constructor(
    message: string = "Address does not belong to the authorized store or customer",
    details?: unknown,
  ) {
    super(message, "ADDRESS_ACCESS_DENIED", 403, details);
  }
}

export class InvalidAddressError extends CustomerDomainError {
  constructor(message: string = "Invalid address data", details?: unknown) {
    super(message, "INVALID_ADDRESS", 400, details);
  }
}

export class DefaultAddressConflictError extends CustomerDomainError {
  constructor(
    message: string = "Conflict occurred while designating default address",
    details?: unknown,
  ) {
    super(message, "DEFAULT_ADDRESS_CONFLICT", 409, details);
  }
}

export class InvalidCustomerUserError extends CustomerDomainError {
  constructor(
    message: string = "Referenced user does not exist",
    details?: unknown,
  ) {
    super(message, "USER_NOT_FOUND", 400, details);
  }
}
