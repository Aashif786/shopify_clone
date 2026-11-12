export class GiftCardDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class GiftCardNotFoundError extends GiftCardDomainError {
  constructor(message = "Gift card not found") {
    super(message, "GIFT_CARD_NOT_FOUND", 404);
  }
}

export class GiftCardExpiredError extends GiftCardDomainError {
  constructor(message = "This gift card has expired") {
    super(message, "GIFT_CARD_EXPIRED", 400);
  }
}

export class GiftCardDepletedError extends GiftCardDomainError {
  constructor(message = "This gift card has a zero balance") {
    super(message, "GIFT_CARD_DEPLETED", 400);
  }
}

export class GiftCardDisabledError extends GiftCardDomainError {
  constructor(message = "This gift card has been disabled") {
    super(message, "GIFT_CARD_DISABLED", 400);
  }
}

export class GiftCardCurrencyMismatchError extends GiftCardDomainError {
  constructor(expected: string, actual: string) {
    super(
      `Gift card currency (${actual}) does not match order currency (${expected})`,
      "GIFT_CARD_CURRENCY_MISMATCH",
      400,
    );
  }
}

export class InsufficientGiftCardBalanceError extends GiftCardDomainError {
  constructor(available: number, requested: number) {
    super(
      `Insufficient gift card balance. Available: ${available}, Requested: ${requested}`,
      "INSUFFICIENT_GIFT_CARD_BALANCE",
      400,
    );
  }
}

export class StoreCreditNotFoundError extends GiftCardDomainError {
  constructor(message = "Store credit account not found") {
    super(message, "STORE_CREDIT_NOT_FOUND", 404);
  }
}

export class InsufficientStoreCreditBalanceError extends GiftCardDomainError {
  constructor(available: number, requested: number) {
    super(
      `Insufficient store credit balance. Available: ${available}, Requested: ${requested}`,
      "INSUFFICIENT_STORE_CREDIT_BALANCE",
      400,
    );
  }
}

export class CrossStoreGiftCardAccessError extends GiftCardDomainError {
  constructor(message = "Gift card does not belong to this store") {
    super(message, "CROSS_STORE_GIFT_CARD_ACCESS", 403);
  }
}
