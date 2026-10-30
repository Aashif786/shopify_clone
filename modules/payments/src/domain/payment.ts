import { generateUuidV7 } from "@calcart/db";
import {
  CapturedAmountExceedsPaymentAmountError,
  InvalidCurrencyError,
  InvalidMonetaryAmountError,
  PaymentNotRefundableError,
  RefundExceedsCapturedAmountError,
} from "./payment-errors.js";
import {
  assertValidPaymentTransition,
  isRefundablePaymentStatus,
  isTerminalPaymentStatus,
  type PaymentStatus,
} from "./payment-state.js";

export const MAX_MONETARY_AMOUNT = 1_000_000_000_000;

export function validatePaymentCurrency(currency: unknown): string {
  if (typeof currency !== "string") {
    throw new InvalidCurrencyError("Currency must be a string");
  }
  const trimmed = currency.trim().toUpperCase();
  if (trimmed.length !== 3 || trimmed !== currency) {
    throw new InvalidCurrencyError(
      "Currency must be a valid 3-character uppercase ISO code (e.g. USD, INR)",
    );
  }
  return trimmed;
}

export function validatePaymentMonetaryAmount(
  amount: unknown,
  fieldName = "Amount",
  allowZero = false,
): number {
  if (
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    !Number.isSafeInteger(amount) ||
    Number.isNaN(amount)
  ) {
    throw new InvalidMonetaryAmountError(
      `${fieldName} must be an integer in minor currency units (e.g. cents/paise)`,
    );
  }
  if (allowZero) {
    if (amount < 0) {
      throw new InvalidMonetaryAmountError(`${fieldName} cannot be negative`);
    }
  } else {
    if (amount <= 0) {
      throw new InvalidMonetaryAmountError(`${fieldName} must be greater than zero`);
    }
  }
  if (amount > MAX_MONETARY_AMOUNT) {
    throw new InvalidMonetaryAmountError(
      `${fieldName} exceeds maximum allowable monetary limit`,
    );
  }
  return amount;
}

export interface PaymentProps {
  id: string;
  storeId: string;
  checkoutId: string;
  orderId?: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  capturedAmount: number;
  refundedAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Payment {
  private readonly _id: string;
  private readonly _storeId: string;
  private readonly _checkoutId: string;
  private _orderId: string | null;
  private readonly _amount: number;
  private readonly _currency: string;
  private _status: PaymentStatus;
  private readonly _provider: string;
  private _capturedAmount: number;
  private _refundedAmount: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: PaymentProps) {
    this._id = props.id;
    this._storeId = props.storeId;
    this._checkoutId = props.checkoutId;
    this._orderId = props.orderId ?? null;
    this._amount = validatePaymentMonetaryAmount(props.amount, "Payment amount", false);
    this._currency = validatePaymentCurrency(props.currency);
    this._status = props.status;
    this._provider = props.provider;

    const cap = validatePaymentMonetaryAmount(props.capturedAmount, "Captured amount", true);
    if (cap > this._amount) {
      throw new CapturedAmountExceedsPaymentAmountError();
    }
    this._capturedAmount = cap;

    const ref = validatePaymentMonetaryAmount(props.refundedAmount, "Refunded amount", true);
    if (ref > this._capturedAmount) {
      throw new RefundExceedsCapturedAmountError();
    }
    this._refundedAmount = ref;

    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: {
    id?: string;
    storeId: string;
    checkoutId: string;
    orderId?: string | null;
    amount: number;
    currency: string;
    provider?: string;
  }): Payment {
    const now = new Date();
    return new Payment({
      id: props.id ?? generateUuidV7(),
      storeId: props.storeId,
      checkoutId: props.checkoutId,
      orderId: props.orderId ?? null,
      amount: props.amount,
      currency: props.currency,
      status: "CREATED",
      provider: props.provider ?? "razorpay",
      capturedAmount: 0,
      refundedAmount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: PaymentProps): Payment {
    return new Payment(props);
  }

  get id(): string {
    return this._id;
  }

  get storeId(): string {
    return this._storeId;
  }

  get checkoutId(): string {
    return this._checkoutId;
  }

  get orderId(): string | null {
    return this._orderId;
  }

  get amount(): number {
    return this._amount;
  }

  get currency(): string {
    return this._currency;
  }

  get status(): PaymentStatus {
    return this._status;
  }

  get provider(): string {
    return this._provider;
  }

  get capturedAmount(): number {
    return this._capturedAmount;
  }

  get refundedAmount(): number {
    return this._refundedAmount;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  isTerminal(): boolean {
    return isTerminalPaymentStatus(this._status);
  }

  isCaptured(): boolean {
    return (
      this._status === "CAPTURED" ||
      this._status === "PARTIALLY_REFUNDED" ||
      this._status === "REFUNDED"
    );
  }

  isRefundable(): boolean {
    return isRefundablePaymentStatus(this._status);
  }

  getRemainingRefundableAmount(): number {
    return Math.max(0, this._capturedAmount - this._refundedAmount);
  }

  setOrderId(orderId: string): void {
    this._orderId = orderId;
    this._updatedAt = new Date();
  }

  markPending(): void {
    this.transitionTo("PENDING");
  }

  markProcessing(): void {
    this.transitionTo("PROCESSING");
  }

  markAuthorized(): void {
    this.transitionTo("AUTHORIZED");
  }

  markCaptured(capturedAmount?: number): void {
    const amountToCapture = capturedAmount !== undefined ? capturedAmount : this._amount;
    const validatedCap = validatePaymentMonetaryAmount(amountToCapture, "Captured amount", false);
    if (validatedCap > this._amount) {
      throw new CapturedAmountExceedsPaymentAmountError();
    }
    this.transitionTo("CAPTURED");
    this._capturedAmount = validatedCap;
  }

  markFailed(): void {
    this.transitionTo("FAILED");
  }

  markCancelled(): void {
    this.transitionTo("CANCELLED");
  }

  markRequiresReconciliation(): void {
    this.transitionTo("REQUIRES_RECONCILIATION");
  }

  recordRefund(amount: number): { isFullRefund: boolean; newStatus: PaymentStatus } {
    if (!this.isRefundable()) {
      throw new PaymentNotRefundableError();
    }
    const validatedRefundAmount = validatePaymentMonetaryAmount(amount, "Refund amount", false);
    const newTotalRefunded = this._refundedAmount + validatedRefundAmount;

    if (newTotalRefunded > this._capturedAmount) {
      throw new RefundExceedsCapturedAmountError();
    }

    const isFullRefund = newTotalRefunded === this._capturedAmount;
    const targetStatus: PaymentStatus = isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED";

    this.transitionTo(targetStatus);
    this._refundedAmount = newTotalRefunded;

    return { isFullRefund, newStatus: targetStatus };
  }

  private transitionTo(newStatus: PaymentStatus): void {
    if (this._status === newStatus) {
      return;
    }
    assertValidPaymentTransition(this._status, newStatus);
    this._status = newStatus;
    this._updatedAt = new Date();
  }
}
