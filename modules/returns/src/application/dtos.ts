import type {
  ReturnRequestActorType,
  ReturnRequestStatus,
} from "../domain/return-state.js";
import type {
  ReturnEligibility,
  ReturnIneligibilityReason,
} from "../domain/return-policy.js";

export interface ReturnRequestItemDTO {
  id: string;
  returnRequestId: string;
  storeId: string;
  orderItemId: string;
  quantity: number;
  unitPriceSnapshot: number;
  lineRefundAmount: number;
  productNameSnapshot: string;
  variantNameSnapshot: string | null;
  skuSnapshot: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnRequestEventDTO {
  id: string;
  returnRequestId: string;
  storeId: string;
  fromStatus: ReturnRequestStatus | null;
  toStatus: ReturnRequestStatus;
  actorType: ReturnRequestActorType;
  actorId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface ReturnRequestDTO {
  id: string;
  storeId: string;
  orderId: string;
  orderNumber?: string | null;
  customerId: string | null;
  returnNumber: string;
  status: ReturnRequestStatus;
  reason: string;
  customerNote: string | null;
  merchantNote: string | null;
  currency: string;
  requestedAmount: number;
  refundedAmount: number | null;
  refundId: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decidedByUserId: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  items?: ReturnRequestItemDTO[];
  events?: ReturnRequestEventDTO[];
}

export interface ReturnPolicyDTO {
  storeId: string;
  isReturnsEnabled: boolean;
  returnWindowDays: number;
  /** True when the store has no persisted policy and the default applies. */
  isDefault: boolean;
}

/** A single line the customer wants to send back. */
export interface RequestedReturnItemInput {
  orderItemId: string;
  quantity: number;
}

export interface CreateReturnRequestInput {
  storeId: string;
  orderId: string;
  /** Resolved server-side from the session; never accepted from the client. */
  customerId?: string | null;
  reason: string;
  customerNote?: string | null;
  items: RequestedReturnItemInput[];
  actorType?: ReturnRequestActorType;
  actorId?: string | null;
}

export interface DecideReturnRequestInput {
  storeId: string;
  returnRequestId: string;
  merchantNote?: string | null;
  actorId?: string | null;
}

export interface CancelReturnRequestInput {
  storeId: string;
  returnRequestId: string;
  /** Ownership is asserted by the caller; used only for the audit trail. */
  actorId?: string | null;
  reason?: string | null;
}

export interface MarkReturnReceivedInput {
  storeId: string;
  returnRequestId: string;
  merchantNote?: string | null;
  actorId?: string | null;
  /** Whether to replenish available inventory for the returned items. Defaults to true. */
  restockItems?: boolean;
}

export interface ListReturnRequestsInput {
  storeId: string;
  status?: ReturnRequestStatus | null;
  orderId?: string | null;
  customerId?: string | null;
  limit?: number;
  offset?: number;
}

export interface ListReturnRequestsResult {
  returns: ReturnRequestDTO[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * What the storefront needs to render the "request a return" affordance:
 * whether the order qualifies, and if so which lines and quantities remain
 * returnable.
 */
export interface ReturnEligibilityDTO {
  orderId: string;
  isEligible: boolean;
  reason: ReturnIneligibilityReason | "RETURN_ALREADY_OPEN" | null;
  windowStartsAt: string | null;
  windowEndsAt: string | null;
  returnWindowDays: number;
  openReturnRequestId: string | null;
  eligibleItems: ReturnEligibleItemDTO[];
}

export interface ReturnEligibleItemDTO {
  orderItemId: string;
  productNameSnapshot: string;
  variantNameSnapshot: string | null;
  skuSnapshot: string | null;
  /** Quantity originally purchased on this line. */
  purchasedQuantity: number;
  /** Quantity still returnable after accounting for prior return requests. */
  returnableQuantity: number;
  unitRefundAmount: number;
}

export function toReturnEligibilityDTO(
  orderId: string,
  eligibility: ReturnEligibility,
  returnWindowDays: number,
  eligibleItems: ReturnEligibleItemDTO[],
  openReturnRequestId: string | null,
): ReturnEligibilityDTO {
  return {
    orderId,
    isEligible: eligibility.isEligible && openReturnRequestId === null,
    reason: openReturnRequestId !== null ? "RETURN_ALREADY_OPEN" : eligibility.reason,
    windowStartsAt: eligibility.windowStartsAt
      ? eligibility.windowStartsAt.toISOString()
      : null,
    windowEndsAt: eligibility.windowEndsAt
      ? eligibility.windowEndsAt.toISOString()
      : null,
    returnWindowDays,
    openReturnRequestId,
    eligibleItems,
  };
}
