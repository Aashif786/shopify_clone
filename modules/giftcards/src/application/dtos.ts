export type GiftCardStatus = "ACTIVE" | "DISABLED" | "DEPLETED" | "EXPIRED";

export type GiftCardTransactionType =
  | "ISSUANCE"
  | "REDEMPTION"
  | "REFUND"
  | "EXPIRATION"
  | "ADJUSTMENT";

export type StoreCreditTransactionType =
  | "ISSUANCE"
  | "REDEMPTION"
  | "REFUND"
  | "ADJUSTMENT";

export interface GiftCardDTO {
  id: string;
  storeId: string;
  code: string;
  maskedCode: string;
  initialBalance: number;
  currentBalance: number;
  currency: string;
  status: GiftCardStatus;
  customerId?: string | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
  message?: string | null;
  expiresAt?: string | null;
  disabledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GiftCardTransactionDTO {
  id: string;
  storeId: string;
  giftCardId: string;
  type: GiftCardTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  checkoutId?: string | null;
  orderId?: string | null;
  idempotencyKey: string;
  notes?: string | null;
  createdAt: string;
}

export interface StoreCreditDTO {
  id: string;
  storeId: string;
  customerId: string;
  currency: string;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoreCreditTransactionDTO {
  id: string;
  storeId: string;
  storeCreditId: string;
  customerId: string;
  type: StoreCreditTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  orderId?: string | null;
  checkoutId?: string | null;
  idempotencyKey: string;
  notes?: string | null;
  createdAt: string;
}

export interface CreateGiftCardInput {
  initialBalance: number;
  currency?: string;
  code?: string;
  customerId?: string | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
  message?: string | null;
  expiresAt?: Date | null;
  notes?: string;
}

export interface RedeemGiftCardInput {
  amount: number;
  currency: string;
  orderId?: string | null;
  checkoutId?: string | null;
  idempotencyKey: string;
  notes?: string;
}

export interface RefundToGiftCardInput {
  amount: number;
  currency: string;
  orderId?: string | null;
  idempotencyKey: string;
  notes?: string;
}

export interface IssueStoreCreditInput {
  amount: number;
  currency?: string;
  orderId?: string | null;
  idempotencyKey: string;
  notes?: string;
}

export interface RedeemStoreCreditInput {
  amount: number;
  currency: string;
  orderId?: string | null;
  checkoutId?: string | null;
  idempotencyKey: string;
  notes?: string;
}

export interface ApplyGiftCardResultDTO {
  giftCardId: string;
  code: string;
  maskedCode: string;
  appliedAmount: number;
  remainingGiftCardBalance: number;
  remainingCheckoutPayable: number;
}

export interface AppliedGiftCardDTO {
  id: string;
  storeId: string;
  checkoutId: string;
  giftCardId: string;
  codeLast4: string;
  maskedCode: string;
  appliedAmount: number;
  currentBalance: number;
  currency: string;
}

export interface ApplyGiftCardToCheckoutInput {
  storeId: string;
  checkoutId: string;
  code: string;
  grossTotal: number;
  currency: string;
}

export interface OrderGiftCardDTO {
  id: string;
  storeId: string;
  orderId: string;
  giftCardId: string;
  codeLast4: string;
  amount: number;
  createdAt: string;
}

export interface AppliedStoreCreditDTO {
  id: string;
  storeId: string;
  checkoutId: string;
  storeCreditId: string;
  customerId: string;
  appliedAmount: number;
  currentBalance: number;
  currency: string;
}

export interface ApplyStoreCreditToCheckoutInput {
  storeId: string;
  checkoutId: string;
  customerId: string;
  grossTotal: number;
  currency: string;
  requestedAmount?: number;
}

export interface OrderStoreCreditDTO {
  id: string;
  storeId: string;
  orderId: string;
  storeCreditId: string;
  customerId: string;
  amount: number;
  createdAt: string;
}

