export class TaxDomainError extends Error {
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

/**
 * The buyer's Indian state could not be resolved to a GST state code, so the
 * supply cannot be classified as intra- or inter-state. Rejected rather than
 * guessed: a wrong guess would charge the wrong tax head.
 */
export class InvalidPlaceOfSupplyError extends TaxDomainError {
  constructor(
    message: string = "Shipping state must be a valid Indian state or union territory",
    details?: unknown,
  ) {
    super(message, "INVALID_PLACE_OF_SUPPLY", 400, details);
  }
}

export class InvalidGstinError extends TaxDomainError {
  constructor(message: string = "GSTIN is not valid", details?: unknown) {
    super(message, "INVALID_GSTIN", 400, details);
  }
}

export class InvalidHsnCodeError extends TaxDomainError {
  constructor(
    message: string = "HSN/SAC code must be 4 to 8 digits",
    details?: unknown,
  ) {
    super(message, "INVALID_HSN_CODE", 400, details);
  }
}

export class InvalidGstRateError extends TaxDomainError {
  constructor(
    message: string = "GST rate must be between 0% and 40%",
    details?: unknown,
  ) {
    super(message, "INVALID_GST_RATE", 400, details);
  }
}

export class TaxSettingsIncompleteError extends TaxDomainError {
  constructor(
    message: string = "Tax cannot be enabled until the store's registration details are complete",
    details?: unknown,
  ) {
    super(message, "TAX_SETTINGS_INCOMPLETE", 400, details);
  }
}

/**
 * Tax is enabled for the store but the checkout's stored tax does not match a
 * fresh calculation. Payment is refused, because charging would under- or
 * over-collect tax.
 */
export class CheckoutTaxNotCurrentError extends TaxDomainError {
  constructor(
    message: string = "Tax has not been calculated for this checkout",
    details?: unknown,
  ) {
    super(message, "CHECKOUT_TAX_NOT_CURRENT", 400, details);
  }
}

export class TaxInvoiceNotFoundError extends TaxDomainError {
  constructor(message: string = "Tax invoice not found", details?: unknown) {
    super(message, "TAX_INVOICE_NOT_FOUND", 404, details);
  }
}

export class InvoiceNotAvailableError extends TaxDomainError {
  constructor(
    message: string = "No tax invoice is available for this order",
    details?: unknown,
  ) {
    super(message, "INVOICE_NOT_AVAILABLE", 404, details);
  }
}

export class InvoiceNumberExhaustedError extends TaxDomainError {
  constructor(
    message: string = "Invoice number sequence is exhausted for this financial year",
    details?: unknown,
  ) {
    super(message, "INVOICE_NUMBER_EXHAUSTED", 500, details);
  }
}
