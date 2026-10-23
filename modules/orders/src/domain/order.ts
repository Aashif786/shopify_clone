import { generateUuidV7 } from "@shopify-clone/db";
import {
  CrossStoreOrderAccessError,
  InvalidCurrencyError,
  InvalidOrderAddressError,
  InvalidOrderStateError,
  OrderCancellationError,
  OrderImmutableError,
  OrderTotalsMismatchError,
  UnauthorizedPaymentStatusChangeError,
} from "./order-errors.js";
import {
  OrderItem,
  validateOrderMonetaryAmount,
} from "./order-item.js";
import {
  assertValidOrderStatusTransition,
  canCancelOrderStatus,
  isTerminalOrderStatus,
  isValidOrderFulfillmentStatus,
  isValidOrderPaymentStatus,
  isValidOrderStatus,
  type OrderAddressType,
  type OrderFulfillmentStatus,
  type OrderPaymentStatus,
  type OrderStatus,
  type OrderStatusHistoryActorType,
} from "./order-state.js";

export function validateOrderCurrency(currency: unknown): string {
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

export interface OrderAddressProps {
  id?: string;
  orderId: string;
  storeId: string;
  type: OrderAddressType;
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class OrderAddress {
  readonly id: string;
  readonly orderId: string;
  readonly storeId: string;
  readonly type: OrderAddressType;
  readonly name: string;
  readonly addressLine1: string;
  readonly addressLine2: string | null;
  readonly city: string;
  readonly state: string | null;
  readonly postalCode: string;
  readonly country: string;
  readonly phone: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: OrderAddressProps) {
    if (!props.name || typeof props.name !== "string" || props.name.trim().length === 0) {
      throw new InvalidOrderAddressError("Address name is required and cannot be empty");
    }
    if (
      !props.addressLine1 ||
      typeof props.addressLine1 !== "string" ||
      props.addressLine1.trim().length === 0
    ) {
      throw new InvalidOrderAddressError("addressLine1 is required and cannot be empty");
    }
    if (!props.city || typeof props.city !== "string" || props.city.trim().length === 0) {
      throw new InvalidOrderAddressError("city is required and cannot be empty");
    }
    if (
      !props.postalCode ||
      typeof props.postalCode !== "string" ||
      props.postalCode.trim().length === 0
    ) {
      throw new InvalidOrderAddressError("postalCode is required and cannot be empty");
    }
    if (
      !props.country ||
      typeof props.country !== "string" ||
      props.country.trim().length === 0
    ) {
      throw new InvalidOrderAddressError("country is required and cannot be empty");
    }

    this.id = props.id ?? generateUuidV7();
    this.orderId = props.orderId;
    this.storeId = props.storeId;
    this.type = props.type;
    this.name = props.name.trim();
    this.addressLine1 = props.addressLine1.trim();
    this.addressLine2 = props.addressLine2 ? props.addressLine2.trim() : null;
    this.city = props.city.trim();
    this.state = props.state ? props.state.trim() : null;
    this.postalCode = props.postalCode.trim();
    this.country = props.country.trim();
    this.phone = props.phone ? props.phone.trim() : null;
    const now = new Date();
    this.createdAt = props.createdAt ?? now;
    this.updatedAt = props.updatedAt ?? now;
  }
}

export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  storeId: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  actorType: OrderStatusHistoryActorType;
  actorId: string | null;
  createdAt: Date;
}

export interface OrderProps {
  id?: string;
  storeId: string;
  orderNumber: string;
  customerId?: string | null;
  checkoutId?: string | null;
  paymentId?: string | null;
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  fulfillmentStatus?: OrderFulfillmentStatus;
  currency: string;
  subtotal: number;
  discountTotal?: number;
  shippingTotal?: number;
  taxTotal?: number;
  total?: number;
  grandTotal?: number;
  cancelledAt?: Date | null;
  cancelReason?: string | null;
  completedAt?: Date | null;
  guestTokenHash?: string | null;
  discountId?: string | null;
  discountCode?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  items?: OrderItem[];
  addresses?: OrderAddress[];
  statusHistory?: OrderStatusHistoryEntry[];
}

export class Order {
  readonly id: string;
  readonly storeId: string;
  readonly orderNumber: string;
  readonly customerId: string | null;
  readonly checkoutId: string | null;
  readonly guestTokenHash: string | null;
  readonly discountId: string | null;
  readonly discountCode: string | null;
  private _paymentId: string | null;
  private _status: OrderStatus;
  private _paymentStatus: OrderPaymentStatus;
  private _fulfillmentStatus: OrderFulfillmentStatus;
  readonly currency: string;
  readonly subtotal: number;
  readonly discountTotal: number;
  readonly shippingTotal: number;
  readonly taxTotal: number;
  readonly total: number;
  readonly grandTotal: number;
  private _cancelledAt: Date | null;
  private _cancelReason: string | null;
  private _completedAt: Date | null;
  readonly createdAt: Date;
  private _updatedAt: Date;
  private readonly _items: OrderItem[];
  private readonly _addresses: OrderAddress[];
  private readonly _statusHistory: OrderStatusHistoryEntry[];

  constructor(props: OrderProps) {
    if (!props.storeId || typeof props.storeId !== "string" || props.storeId.trim().length === 0) {
      throw new InvalidOrderStateError("storeId is required for Order");
    }
    if (
      !props.orderNumber ||
      typeof props.orderNumber !== "string" ||
      props.orderNumber.trim().length === 0
    ) {
      throw new InvalidOrderStateError("orderNumber is required for Order");
    }

    this.id = props.id ?? generateUuidV7();
    this.storeId = props.storeId.trim();
    this.orderNumber = props.orderNumber.trim();
    this.customerId = props.customerId ? props.customerId.trim() : null;
    this.checkoutId = props.checkoutId ? props.checkoutId.trim() : null;
    this.guestTokenHash = props.guestTokenHash ? props.guestTokenHash.trim() : null;
    this.discountId = props.discountId ? props.discountId.trim() : null;
    this.discountCode = props.discountCode ? props.discountCode.trim().toUpperCase() : null;
    this._paymentId = props.paymentId ? props.paymentId.trim() : null;

    const initialStatus = props.status ?? "PENDING";
    if (!isValidOrderStatus(initialStatus)) {
      throw new InvalidOrderStateError(`Invalid initial order status '${props.status}'`);
    }
    this._status = initialStatus;

    const initialPaymentStatus = props.paymentStatus ?? "PENDING";
    if (!isValidOrderPaymentStatus(initialPaymentStatus)) {
      throw new InvalidOrderStateError(
        `Invalid initial order payment status '${props.paymentStatus}'`,
      );
    }
    this._paymentStatus = initialPaymentStatus;

    const initialFulfillmentStatus = props.fulfillmentStatus ?? "UNFULFILLED";
    if (!isValidOrderFulfillmentStatus(initialFulfillmentStatus)) {
      throw new InvalidOrderStateError(
        `Invalid initial order fulfillment status '${props.fulfillmentStatus}'`,
      );
    }
    this._fulfillmentStatus = initialFulfillmentStatus;

    this.currency = validateOrderCurrency(props.currency);
    this.subtotal = validateOrderMonetaryAmount(props.subtotal, "Subtotal", true);
    this.discountTotal = validateOrderMonetaryAmount(
      props.discountTotal ?? 0,
      "Discount total",
      true,
    );
    this.shippingTotal = validateOrderMonetaryAmount(
      props.shippingTotal ?? 0,
      "Shipping total",
      true,
    );
    this.taxTotal = validateOrderMonetaryAmount(props.taxTotal ?? 0, "Tax total", true);

    const calculatedTotal =
      this.subtotal - this.discountTotal + this.shippingTotal + this.taxTotal;
    if (calculatedTotal < 0) {
      throw new InvalidOrderStateError("Calculated order total cannot be negative");
    }
    validateOrderMonetaryAmount(calculatedTotal, "Calculated total", true);

    if (props.total !== undefined && props.total !== calculatedTotal) {
      throw new OrderTotalsMismatchError(
        `Supplied order total (${props.total}) does not match calculated total (${calculatedTotal})`,
      );
    }
    this.total = calculatedTotal;

    const grandTotal = props.grandTotal ?? this.total;
    if (grandTotal !== this.total) {
      throw new OrderTotalsMismatchError(
        `Grand total (${grandTotal}) must match order total (${this.total})`,
      );
    }
    this.grandTotal = grandTotal;

    this._cancelledAt = props.cancelledAt ?? null;
    this._cancelReason = props.cancelReason ?? null;
    this._completedAt = props.completedAt ?? null;

    const now = new Date();
    this.createdAt = props.createdAt ?? now;
    this._updatedAt = props.updatedAt ?? now;

    this._items = props.items ? [...props.items] : [];
    this._addresses = props.addresses ? [...props.addresses] : [];
    this._statusHistory = props.statusHistory ? [...props.statusHistory] : [];

    // If items are provided, verify items consistency
    if (this._items.length > 0) {
      const itemsSubtotal = this._items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      if (itemsSubtotal !== this.subtotal) {
        throw new OrderTotalsMismatchError(
          `Items subtotal (${itemsSubtotal}) does not match order subtotal (${this.subtotal})`,
        );
      }
    }
  }

  get status(): OrderStatus {
    return this._status;
  }

  get paymentStatus(): OrderPaymentStatus {
    return this._paymentStatus;
  }

  get fulfillmentStatus(): OrderFulfillmentStatus {
    return this._fulfillmentStatus;
  }

  get paymentId(): string | null {
    return this._paymentId;
  }

  get cancelledAt(): Date | null {
    return this._cancelledAt;
  }

  get cancelReason(): string | null {
    return this._cancelReason;
  }

  get completedAt(): Date | null {
    return this._completedAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get items(): readonly OrderItem[] {
    return [...this._items];
  }

  get addresses(): readonly OrderAddress[] {
    return [...this._addresses];
  }

  get statusHistory(): readonly OrderStatusHistoryEntry[] {
    return [...this._statusHistory];
  }

  confirm(): void {
    this.transitionStatus("CONFIRMED");
  }

  startProcessing(): void {
    this.transitionStatus("PROCESSING");
  }

  markShipped(): void {
    this.transitionStatus("SHIPPED");
    this._fulfillmentStatus = "FULFILLED";
  }

  markDelivered(): void {
    this.transitionStatus("DELIVERED");
  }

  complete(): void {
    this.transitionStatus("COMPLETED");
  }

  cancel(reason: string): void {
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      throw new OrderCancellationError("Cancel reason is required");
    }
    if (isTerminalOrderStatus(this._status)) {
      throw new OrderImmutableError(
        `Order is in terminal status '${this._status}' and cannot be cancelled`,
      );
    }
    if (!canCancelOrderStatus(this._status)) {
      throw new OrderCancellationError(
        `Cannot cancel order in status '${this._status}'. Cancellation is only permitted from PENDING, CONFIRMED, or PROCESSING.`,
      );
    }

    this._status = "CANCELLED";
    this._cancelledAt = new Date();
    this._cancelReason = reason.trim();
    this._fulfillmentStatus = "CANCELLED";
    this._updatedAt = new Date();
  }

  transitionStatus(toStatus: OrderStatus, reason?: string | null): void {
    if (this._status === toStatus) {
      return; // Idempotent no-op
    }

    if (isTerminalOrderStatus(this._status)) {
      throw new OrderImmutableError(
        `Order is in terminal status '${this._status}' and cannot transition to '${toStatus}'`,
      );
    }

    if (toStatus === "CANCELLED") {
      this.cancel(reason ?? "Cancelled by user");
      return;
    }

    assertValidOrderStatusTransition(this._status, toStatus);

    this._status = toStatus;
    if (toStatus === "COMPLETED") {
      this._completedAt = new Date();
    }
    this._updatedAt = new Date();
  }

  updatePaymentStatus(
    newPaymentStatus: OrderPaymentStatus,
    authorizedInternal = false,
  ): void {
    if (!authorizedInternal) {
      throw new UnauthorizedPaymentStatusChangeError(
        "Direct update to payment status is forbidden without authorized internal payment path",
      );
    }
    if (!isValidOrderPaymentStatus(newPaymentStatus)) {
      throw new InvalidOrderStateError(`Invalid payment status '${newPaymentStatus}'`);
    }
    this._paymentStatus = newPaymentStatus;
    this._updatedAt = new Date();
  }

  setPaymentId(paymentId: string): void {
    if (!paymentId || paymentId.trim().length === 0) {
      throw new InvalidOrderStateError("paymentId cannot be empty");
    }
    this._paymentId = paymentId.trim();
    this._updatedAt = new Date();
  }

  updateFulfillmentStatus(newFulfillmentStatus: OrderFulfillmentStatus): void {
    if (!isValidOrderFulfillmentStatus(newFulfillmentStatus)) {
      throw new InvalidOrderStateError(
        `Invalid fulfillment status '${newFulfillmentStatus}'`,
      );
    }
    this._fulfillmentStatus = newFulfillmentStatus;
    this._updatedAt = new Date();
  }

  assertBelongsToStore(storeId: string): void {
    if (this.storeId !== storeId) {
      throw new CrossStoreOrderAccessError(
        `Order '${this.id}' does not belong to store '${storeId}'`,
      );
    }
  }
}
