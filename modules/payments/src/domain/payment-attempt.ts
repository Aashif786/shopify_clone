import { generateUuidV7 } from "@shopify-clone/db";
import {
  PaymentValidationError,
} from "./payment-errors.js";
import {
  validatePaymentCurrency,
  validatePaymentMonetaryAmount,
} from "./payment.js";
import {
  assertValidPaymentAttemptTransition,
  type PaymentAttemptStatus,
} from "./payment-state.js";

export interface PaymentAttemptProps {
  id: string;
  paymentId: string;
  storeId: string;
  attemptNumber: number;
  provider: string;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  providerSignature?: string | null;
  amount: number;
  currency: string;
  status: PaymentAttemptStatus;
  failureCode?: string | null;
  failureMessage?: string | null;
  idempotencyKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PaymentAttempt {
  private readonly _id: string;
  private readonly _paymentId: string;
  private readonly _storeId: string;
  private readonly _attemptNumber: number;
  private readonly _provider: string;
  private _providerOrderId: string | null;
  private _providerPaymentId: string | null;
  private _providerSignature: string | null;
  private readonly _amount: number;
  private readonly _currency: string;
  private _status: PaymentAttemptStatus;
  private _failureCode: string | null;
  private _failureMessage: string | null;
  private readonly _idempotencyKey: string | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: PaymentAttemptProps) {
    if (!Number.isInteger(props.attemptNumber) || props.attemptNumber <= 0) {
      throw new PaymentValidationError("Attempt number must be a positive integer greater than zero");
    }

    this._id = props.id;
    this._paymentId = props.paymentId;
    this._storeId = props.storeId;
    this._attemptNumber = props.attemptNumber;
    this._provider = props.provider;
    this._providerOrderId = props.providerOrderId ?? null;
    this._providerPaymentId = props.providerPaymentId ?? null;
    this._providerSignature = props.providerSignature ?? null;
    this._amount = validatePaymentMonetaryAmount(props.amount, "Attempt amount", false);
    this._currency = validatePaymentCurrency(props.currency);
    this._status = props.status;
    this._failureCode = props.failureCode ?? null;
    this._failureMessage = props.failureMessage ?? null;
    this._idempotencyKey = props.idempotencyKey ?? null;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: {
    id?: string;
    paymentId: string;
    storeId: string;
    attemptNumber: number;
    provider?: string;
    providerOrderId?: string | null;
    providerPaymentId?: string | null;
    amount: number;
    currency: string;
    idempotencyKey?: string | null;
  }): PaymentAttempt {
    const now = new Date();
    return new PaymentAttempt({
      id: props.id ?? generateUuidV7(),
      paymentId: props.paymentId,
      storeId: props.storeId,
      attemptNumber: props.attemptNumber,
      provider: props.provider ?? "razorpay",
      providerOrderId: props.providerOrderId ?? null,
      providerPaymentId: props.providerPaymentId ?? null,
      amount: props.amount,
      currency: props.currency,
      status: "INITIATED",
      idempotencyKey: props.idempotencyKey ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: PaymentAttemptProps): PaymentAttempt {
    return new PaymentAttempt(props);
  }

  get id(): string {
    return this._id;
  }

  get paymentId(): string {
    return this._paymentId;
  }

  get storeId(): string {
    return this._storeId;
  }

  get attemptNumber(): number {
    return this._attemptNumber;
  }

  get provider(): string {
    return this._provider;
  }

  get providerOrderId(): string | null {
    return this._providerOrderId;
  }

  get providerPaymentId(): string | null {
    return this._providerPaymentId;
  }

  get providerSignature(): string | null {
    return this._providerSignature;
  }

  get amount(): number {
    return this._amount;
  }

  get currency(): string {
    return this._currency;
  }

  get status(): PaymentAttemptStatus {
    return this._status;
  }

  get failureCode(): string | null {
    return this._failureCode;
  }

  get failureMessage(): string | null {
    return this._failureMessage;
  }

  get idempotencyKey(): string | null {
    return this._idempotencyKey;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  markPending(providerOrderId?: string): void {
    if (providerOrderId) {
      this._providerOrderId = providerOrderId;
    }
    this.transitionTo("PENDING");
  }

  markAuthorized(providerPaymentId?: string): void {
    if (providerPaymentId) {
      this._providerPaymentId = providerPaymentId;
    }
    this.transitionTo("AUTHORIZED");
  }

  markCaptured(providerPaymentId?: string, signature?: string): void {
    if (providerPaymentId) {
      this._providerPaymentId = providerPaymentId;
    }
    if (signature) {
      this._providerSignature = signature;
    }
    this.transitionTo("CAPTURED");
  }

  markFailed(failureCode?: string, failureMessage?: string): void {
    if (failureCode) {
      this._failureCode = failureCode;
    }
    if (failureMessage) {
      this._failureMessage = failureMessage;
    }
    this.transitionTo("FAILED");
  }

  markCancelled(): void {
    this.transitionTo("CANCELLED");
  }

  markRequiresReconciliation(): void {
    this.transitionTo("REQUIRES_RECONCILIATION");
  }

  private transitionTo(newStatus: PaymentAttemptStatus): void {
    if (this._status === newStatus) {
      return;
    }
    assertValidPaymentAttemptTransition(this._status, newStatus);
    this._status = newStatus;
    this._updatedAt = new Date();
  }
}
