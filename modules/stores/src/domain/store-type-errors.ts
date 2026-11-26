import { StoreDomainError } from "./errors.js";

export class StoreTypeNotFoundError extends StoreDomainError {
  constructor(message: string = "Store type not found", details?: unknown) {
    super(message, "STORE_TYPE_NOT_FOUND", 404, details);
  }
}

export class DuplicateStoreTypeKeyError extends StoreDomainError {
  constructor(key: string) {
    super(
      `Store type key '${key}' is already in use`,
      "STORE_TYPE_KEY_ALREADY_EXISTS",
      409,
      { key },
    );
  }
}

export class StoreTypeInUseError extends StoreDomainError {
  constructor(storeCount: number) {
    super(
      `Store type is assigned to ${storeCount} store(s). Reassign them to another store type before deleting.`,
      "STORE_TYPE_IN_USE",
      409,
      { storeCount },
    );
  }
}

export class InvalidStoreTypeError extends StoreDomainError {
  constructor(message: string, details?: unknown) {
    super(message, "INVALID_STORE_TYPE", 400, details);
  }
}

export class FitCheckNotEligibleError extends StoreDomainError {
  constructor() {
    super(
      "Fit Check is only available for clothing/fashion store types",
      "FIT_CHECK_NOT_ELIGIBLE",
      422,
    );
  }
}
