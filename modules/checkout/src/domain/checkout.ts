import { generateUuidV7 } from "@shopify-clone/db";
import {
  CheckoutExpiredError,
  CheckoutItemNotFoundError,
  DuplicateCheckoutItemError,
  InvalidCheckoutAddressError,
  InvalidCheckoutItemError,
  InvalidCheckoutPriceError,
  InvalidCurrencyError,
  InvalidQuantityError,
} from "./checkout-errors.js";
import {
  assertCheckoutEditable,
  assertValidCheckoutTransition,
  isCheckoutEditable,
  isTerminalCheckoutStatus,
  isValidCheckoutStatus,
  isValidPaymentStatus,
  type CheckoutPaymentStatus,
  type CheckoutStatus,
} from "./checkout-state.js";

export const DEFAULT_CHECKOUT_CURRENCY = "USD";
export const DEFAULT_MAX_CHECKOUT_ITEM_QUANTITY = 999;

export function validateCheckoutCurrency(currency: unknown): string {
  if (typeof currency !== "string") {
    throw new InvalidCurrencyError("Currency must be a string");
  }
  const trimmed = currency.trim().toUpperCase();
  if (trimmed.length !== 3 || trimmed !== currency) {
    throw new InvalidCurrencyError(
      "Currency must be a valid 3-character uppercase ISO code (e.g. USD)",
    );
  }
  return trimmed;
}

export const MAX_MONETARY_AMOUNT = 1_000_000_000_000;

export function validateMonetaryAmount(
  amount: unknown,
  fieldName = "Amount",
): number {
  if (
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    !Number.isSafeInteger(amount) ||
    Number.isNaN(amount)
  ) {
    throw new InvalidCheckoutPriceError(
      `${fieldName} must be an integer minor units (e.g. cents)`,
    );
  }
  if (amount < 0) {
    throw new InvalidCheckoutPriceError(`${fieldName} cannot be negative`);
  }
  if (amount > MAX_MONETARY_AMOUNT) {
    throw new InvalidCheckoutPriceError(
      `${fieldName} exceeds maximum allowable monetary limit`,
    );
  }
  return amount;
}

export function validateCheckoutQuantity(
  quantity: unknown,
  maxQuantity: number = DEFAULT_MAX_CHECKOUT_ITEM_QUANTITY,
): number {
  if (
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    Number.isNaN(quantity)
  ) {
    throw new InvalidQuantityError("Quantity must be a valid integer");
  }
  if (quantity <= 0) {
    throw new InvalidQuantityError(
      "Quantity must be a positive integer greater than zero",
    );
  }
  if (quantity > maxQuantity) {
    throw new InvalidQuantityError(
      `Quantity cannot exceed the maximum allowed limit of ${maxQuantity}`,
    );
  }
  return quantity;
}

export interface CheckoutAddress {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}

export function validateCheckoutAddress(address: unknown): CheckoutAddress {
  if (typeof address !== "object" || address === null) {
    throw new InvalidCheckoutAddressError("Address must be a non-null object");
  }
  const addr = address as Record<string, unknown>;

  if (typeof addr.addressLine1 !== "string" || addr.addressLine1.trim().length === 0) {
    throw new InvalidCheckoutAddressError("addressLine1 is required and must not be empty");
  }
  if (typeof addr.city !== "string" || addr.city.trim().length === 0) {
    throw new InvalidCheckoutAddressError("city is required and must not be empty");
  }
  if (typeof addr.postalCode !== "string" || addr.postalCode.trim().length === 0) {
    throw new InvalidCheckoutAddressError("postalCode is required and must not be empty");
  }
  if (typeof addr.country !== "string" || addr.country.trim().length === 0) {
    throw new InvalidCheckoutAddressError("country is required and must not be empty");
  }

  return {
    addressLine1: addr.addressLine1.trim(),
    addressLine2: typeof addr.addressLine2 === "string" ? addr.addressLine2.trim() : null,
    city: addr.city.trim(),
    state: typeof addr.state === "string" ? addr.state.trim() : null,
    postalCode: addr.postalCode.trim(),
    country: addr.country.trim(),
    firstName: typeof addr.firstName === "string" ? addr.firstName.trim() : null,
    lastName: typeof addr.lastName === "string" ? addr.lastName.trim() : null,
    phone: typeof addr.phone === "string" ? addr.phone.trim() : null,
  };
}

export interface CheckoutItemData {
  id: string;
  checkoutId: string;
  storeId: string;
  variantId: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  skuSnapshot: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCheckoutItemParams {
  id?: string;
  checkoutId: string;
  storeId: string;
  variantId: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  skuSnapshot?: string | null;
  unitPrice: number;
  quantity: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CheckoutItem {
  readonly id: string;
  readonly checkoutId: string;
  readonly storeId: string;
  readonly variantId: string;
  readonly productNameSnapshot: string;
  readonly variantNameSnapshot: string;
  readonly skuSnapshot: string | null;
  readonly unitPrice: number;
  private _quantity: number;
  private _lineTotal: number;
  readonly createdAt: Date;
  private _updatedAt: Date;

  constructor(params: CreateCheckoutItemParams) {
    if (!params.checkoutId) {
      throw new InvalidCheckoutItemError("checkoutId is required for CheckoutItem");
    }
    if (!params.storeId) {
      throw new InvalidCheckoutItemError("storeId is required for CheckoutItem");
    }
    if (!params.variantId) {
      throw new InvalidCheckoutItemError("variantId is required for CheckoutItem");
    }
    if (!params.productNameSnapshot || params.productNameSnapshot.trim().length === 0) {
      throw new InvalidCheckoutItemError("productNameSnapshot is required for CheckoutItem");
    }
    if (!params.variantNameSnapshot || params.variantNameSnapshot.trim().length === 0) {
      throw new InvalidCheckoutItemError("variantNameSnapshot is required for CheckoutItem");
    }

    this.id = params.id ?? generateUuidV7();
    this.checkoutId = params.checkoutId;
    this.storeId = params.storeId;
    this.variantId = params.variantId;
    this.productNameSnapshot = params.productNameSnapshot.trim();
    this.variantNameSnapshot = params.variantNameSnapshot.trim();
    this.skuSnapshot = params.skuSnapshot ? params.skuSnapshot.trim() : null;
    this.unitPrice = validateMonetaryAmount(params.unitPrice, "Unit price");
    this._quantity = validateCheckoutQuantity(params.quantity);
    this._lineTotal = this._quantity * this.unitPrice;
    const now = new Date();
    this.createdAt = params.createdAt ?? now;
    this._updatedAt = params.updatedAt ?? now;
  }

  get quantity(): number {
    return this._quantity;
  }

  get lineTotal(): number {
    return this._lineTotal;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  updateQuantity(newQuantity: number): void {
    const validQty = validateCheckoutQuantity(newQuantity);
    this._quantity = validQty;
    this._lineTotal = validQty * this.unitPrice;
    this._updatedAt = new Date();
  }

  toData(): CheckoutItemData {
    return {
      id: this.id,
      checkoutId: this.checkoutId,
      storeId: this.storeId,
      variantId: this.variantId,
      productNameSnapshot: this.productNameSnapshot,
      variantNameSnapshot: this.variantNameSnapshot,
      skuSnapshot: this.skuSnapshot,
      unitPrice: this.unitPrice,
      quantity: this._quantity,
      lineTotal: this._lineTotal,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

export interface CheckoutData {
  id: string;
  storeId: string;
  cartId: string;
  customerId: string | null;
  email: string | null;
  status: CheckoutStatus;
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingTotal: number;
  total: number;
  shippingAddress: CheckoutAddress | null;
  billingAddress: CheckoutAddress | null;
  paymentStatus: CheckoutPaymentStatus;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: CheckoutItemData[];
}

export interface CreateCheckoutParams {
  id?: string;
  storeId: string;
  cartId: string;
  customerId?: string | null;
  email?: string | null;
  currency?: string;
  expiresAt?: Date | null;
  shippingAddress?: CheckoutAddress | null;
  billingAddress?: CheckoutAddress | null;
  items?: Array<Omit<CreateCheckoutItemParams, "checkoutId" | "storeId">>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ReconstituteCheckoutParams {
  id: string;
  storeId: string;
  cartId: string;
  customerId: string | null;
  email: string | null;
  status: CheckoutStatus;
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingTotal: number;
  total: number;
  shippingAddress: CheckoutAddress | null;
  billingAddress: CheckoutAddress | null;
  paymentStatus: CheckoutPaymentStatus;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items?: CheckoutItem[];
}

export class Checkout {
  readonly id: string;
  readonly storeId: string;
  readonly cartId: string;
  private _customerId: string | null;
  private _email: string | null;
  private _status: CheckoutStatus;
  private _currency: string;
  private _subtotal: number;
  private _discountTotal: number;
  private _taxTotal: number;
  private _shippingTotal: number;
  private _total: number;
  private _shippingAddress: CheckoutAddress | null;
  private _billingAddress: CheckoutAddress | null;
  private _paymentStatus: CheckoutPaymentStatus;
  private _expiresAt: Date | null;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _items: Map<string, CheckoutItem>;

  private constructor(
    id: string,
    storeId: string,
    cartId: string,
    customerId: string | null,
    email: string | null,
    status: CheckoutStatus,
    currency: string,
    subtotal: number,
    discountTotal: number,
    taxTotal: number,
    shippingTotal: number,
    total: number,
    shippingAddress: CheckoutAddress | null,
    billingAddress: CheckoutAddress | null,
    paymentStatus: CheckoutPaymentStatus,
    expiresAt: Date | null,
    createdAt: Date,
    updatedAt: Date,
    items: CheckoutItem[] = [],
  ) {
    this.id = id;
    this.storeId = storeId;
    this.cartId = cartId;
    this._customerId = customerId;
    this._email = email;
    this._status = status;
    this._currency = currency;
    this._subtotal = subtotal;
    this._discountTotal = discountTotal;
    this._taxTotal = taxTotal;
    this._shippingTotal = shippingTotal;
    this._total = total;
    this._shippingAddress = shippingAddress;
    this._billingAddress = billingAddress;
    this._paymentStatus = paymentStatus;
    this._expiresAt = expiresAt;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
    this._items = new Map();

    for (const item of items) {
      this._items.set(item.variantId, item);
    }
  }

  static create(params: CreateCheckoutParams): Checkout {
    if (!params.storeId || params.storeId.trim().length === 0) {
      throw new Error("storeId is required to create a checkout");
    }
    if (!params.cartId || params.cartId.trim().length === 0) {
      throw new Error("cartId is required to create a checkout");
    }

    const id = params.id ?? generateUuidV7();
    const currency = validateCheckoutCurrency(params.currency ?? DEFAULT_CHECKOUT_CURRENCY);
    const email = params.email ? params.email.trim().toLowerCase() : null;
    const shippingAddress = params.shippingAddress ? validateCheckoutAddress(params.shippingAddress) : null;
    const billingAddress = params.billingAddress ? validateCheckoutAddress(params.billingAddress) : null;
    const now = new Date();

    const initialItems: CheckoutItem[] = [];
    if (params.items && params.items.length > 0) {
      for (const itemParams of params.items) {
        initialItems.push(
          new CheckoutItem({
            ...itemParams,
            checkoutId: id,
            storeId: params.storeId,
          }),
        );
      }
    }

    const checkout = new Checkout(
      id,
      params.storeId,
      params.cartId,
      params.customerId ?? null,
      email,
      "OPEN",
      currency,
      0,
      0,
      0,
      0,
      0,
      shippingAddress,
      billingAddress,
      "PENDING",
      params.expiresAt ?? null,
      params.createdAt ?? now,
      params.updatedAt ?? now,
      initialItems,
    );

    if (initialItems.length > 0) {
      checkout.recalculateTotals();
    }

    return checkout;
  }

  static reconstitute(params: ReconstituteCheckoutParams): Checkout {
    if (!isValidCheckoutStatus(params.status)) {
      throw new Error(`Invalid status when reconstituting Checkout: ${params.status}`);
    }
    if (!isValidPaymentStatus(params.paymentStatus)) {
      throw new Error(`Invalid paymentStatus when reconstituting Checkout: ${params.paymentStatus}`);
    }

    return new Checkout(
      params.id,
      params.storeId,
      params.cartId,
      params.customerId,
      params.email,
      params.status,
      validateCheckoutCurrency(params.currency),
      validateMonetaryAmount(params.subtotal, "subtotal"),
      validateMonetaryAmount(params.discountTotal, "discountTotal"),
      validateMonetaryAmount(params.taxTotal, "taxTotal"),
      validateMonetaryAmount(params.shippingTotal, "shippingTotal"),
      validateMonetaryAmount(params.total, "total"),
      params.shippingAddress,
      params.billingAddress,
      params.paymentStatus,
      params.expiresAt,
      params.createdAt,
      params.updatedAt,
      params.items ?? [],
    );
  }

  // --- Getters ---

  get customerId(): string | null {
    return this._customerId;
  }

  get email(): string | null {
    return this._email;
  }

  get status(): CheckoutStatus {
    return this._status;
  }

  get currency(): string {
    return this._currency;
  }

  get subtotal(): number {
    return this._subtotal;
  }

  get discountTotal(): number {
    return this._discountTotal;
  }

  get taxTotal(): number {
    return this._taxTotal;
  }

  get shippingTotal(): number {
    return this._shippingTotal;
  }

  get total(): number {
    return this._total;
  }

  get shippingAddress(): CheckoutAddress | null {
    return this._shippingAddress ? { ...this._shippingAddress } : null;
  }

  get billingAddress(): CheckoutAddress | null {
    return this._billingAddress ? { ...this._billingAddress } : null;
  }

  get paymentStatus(): CheckoutPaymentStatus {
    return this._paymentStatus;
  }

  get expiresAt(): Date | null {
    return this._expiresAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get items(): CheckoutItem[] {
    return Array.from(this._items.values());
  }

  get itemCount(): number {
    let count = 0;
    for (const item of this._items.values()) {
      count += item.quantity;
    }
    return count;
  }

  get uniqueItemCount(): number {
    return this._items.size;
  }

  // --- Guards ---

  private assertEditable(): void {
    assertCheckoutEditable(this._status);
    if (this.isExpired()) {
      throw new CheckoutExpiredError("Checkout has expired and cannot be modified");
    }
  }

  isEditable(): boolean {
    return isCheckoutEditable(this._status);
  }

  isCompleted(): boolean {
    return this._status === "COMPLETED";
  }

  isTerminal(): boolean {
    return isTerminalCheckoutStatus(this._status);
  }

  isExpired(now: Date = new Date()): boolean {
    if (this._status === "EXPIRED") {
      return true;
    }
    return this._expiresAt !== null && now > this._expiresAt;
  }

  hasVariant(variantId: string): boolean {
    return this._items.has(variantId);
  }

  getItem(variantId: string): CheckoutItem | undefined {
    return this._items.get(variantId);
  }

  // --- Item Management ---

  addItem(
    params: Omit<CreateCheckoutItemParams, "checkoutId" | "storeId">,
  ): CheckoutItem {
    this.assertEditable();

    if (this.hasVariant(params.variantId)) {
      throw new DuplicateCheckoutItemError(
        `Variant ${params.variantId} already exists in checkout`,
        { variantId: params.variantId },
      );
    }

    const item = new CheckoutItem({
      ...params,
      checkoutId: this.id,
      storeId: this.storeId,
    });

    this._items.set(params.variantId, item);
    this.recalculateTotals();
    this._updatedAt = new Date();
    return item;
  }

  updateItemQuantity(variantId: string, quantity: number): CheckoutItem {
    this.assertEditable();

    const item = this._items.get(variantId);
    if (!item) {
      throw new CheckoutItemNotFoundError(
        `Item for variant ${variantId} not found in checkout`,
        { variantId },
      );
    }

    item.updateQuantity(quantity);
    this.recalculateTotals();
    this._updatedAt = new Date();
    return item;
  }

  removeItem(variantId: string): void {
    this.assertEditable();

    if (!this._items.has(variantId)) {
      throw new CheckoutItemNotFoundError(
        `Item for variant ${variantId} not found in checkout`,
        { variantId },
      );
    }

    this._items.delete(variantId);
    this.recalculateTotals();
    this._updatedAt = new Date();
  }

  clearItems(): void {
    this.assertEditable();

    this._items.clear();
    this.recalculateTotals();
    this._updatedAt = new Date();
  }

  // --- Customer & Identity Management ---

  setCustomer(customerId: string | null): void {
    this.assertEditable();
    this._customerId = customerId;
    this._updatedAt = new Date();
  }

  setEmail(email: string | null): void {
    this.assertEditable();
    this._email = email ? email.trim().toLowerCase() : null;
    this._updatedAt = new Date();
  }

  setShippingAddress(address: CheckoutAddress | null): void {
    this.assertEditable();
    this._shippingAddress = address ? validateCheckoutAddress(address) : null;
    this._updatedAt = new Date();
  }

  setBillingAddress(address: CheckoutAddress | null): void {
    this.assertEditable();
    this._billingAddress = address ? validateCheckoutAddress(address) : null;
    this._updatedAt = new Date();
  }

  setExpiresAt(expiresAt: Date | null): void {
    this.assertEditable();
    this._expiresAt = expiresAt;
    this._updatedAt = new Date();
  }

  // --- Monetary & Totals Management ---

  setDiscountTotal(amount: number): void {
    this.assertEditable();
    this._discountTotal = validateMonetaryAmount(amount, "Discount total");
    this.recalculateTotals();
    this._updatedAt = new Date();
  }

  setTaxTotal(amount: number): void {
    this.assertEditable();
    this._taxTotal = validateMonetaryAmount(amount, "Tax total");
    this.recalculateTotals();
    this._updatedAt = new Date();
  }

  setShippingTotal(amount: number): void {
    this.assertEditable();
    this._shippingTotal = validateMonetaryAmount(amount, "Shipping total");
    this.recalculateTotals();
    this._updatedAt = new Date();
  }

  setTotals(
    subtotal: number,
    discountTotal: number,
    taxTotal: number,
    shippingTotal: number,
    total: number,
  ): void {
    this.assertEditable();
    const validSubtotal = validateMonetaryAmount(subtotal, "subtotal");
    const validDiscountTotal = validateMonetaryAmount(discountTotal, "discountTotal");
    const validTaxTotal = validateMonetaryAmount(taxTotal, "taxTotal");
    const validShippingTotal = validateMonetaryAmount(shippingTotal, "shippingTotal");
    const validTotal = validateMonetaryAmount(total, "total");

    if (this._items.size > 0) {
      let expectedSubtotal = 0;
      for (const item of this._items.values()) {
        expectedSubtotal += item.lineTotal;
      }
      if (validSubtotal !== expectedSubtotal) {
        throw new InvalidCheckoutPriceError(
          `Subtotal ${validSubtotal} does not match sum of item line totals ${expectedSubtotal}`,
        );
      }
    }

    const calculatedTotal = Math.max(
      0,
      validSubtotal - validDiscountTotal + validTaxTotal + validShippingTotal,
    );
    if (validTotal !== calculatedTotal) {
      throw new InvalidCheckoutPriceError(
        `Total amount ${validTotal} does not match computed total ${calculatedTotal} (subtotal: ${validSubtotal}, discount: ${validDiscountTotal}, tax: ${validTaxTotal}, shipping: ${validShippingTotal})`,
      );
    }

    this._subtotal = validSubtotal;
    this._discountTotal = validDiscountTotal;
    this._taxTotal = validTaxTotal;
    this._shippingTotal = validShippingTotal;
    this._total = validTotal;
    this._updatedAt = new Date();
  }

  private recalculateTotals(): void {
    let subtotal = 0;
    for (const item of this._items.values()) {
      subtotal += item.lineTotal;
    }
    this._subtotal = subtotal;
    // Total is: subtotal - discountTotal + taxTotal + shippingTotal (cannot be negative)
    const rawTotal = subtotal - this._discountTotal + this._taxTotal + this._shippingTotal;
    this._total = Math.max(0, rawTotal);
  }

  // --- Payment Status Management ---

  setPaymentStatus(status: CheckoutPaymentStatus): void {
    if (!isValidPaymentStatus(status)) {
      throw new Error(`Invalid payment status: ${status}`);
    }
    this._paymentStatus = status;
    this._updatedAt = new Date();
  }

  // --- Lifecycle Transitions ---

  transitionTo(newStatus: CheckoutStatus): void {
    assertValidCheckoutTransition(this._status, newStatus);
    this._status = newStatus;
    this._updatedAt = new Date();
  }

  beginPayment(): void {
    if (this.isExpired()) {
      throw new CheckoutExpiredError("Checkout has expired and cannot enter payment");
    }
    this.transitionTo("PAYMENT_PENDING");
  }

  markPaymentFailed(): void {
    // Allows customer retry by returning to OPEN
    this.transitionTo("OPEN");
  }

  markCompleted(): void {
    if (this.isExpired()) {
      throw new CheckoutExpiredError("Checkout has expired and cannot be completed");
    }
    this.transitionTo("COMPLETED");
  }

  markCancelled(): void {
    this.transitionTo("CANCELLED");
  }

  markExpired(): void {
    this.transitionTo("EXPIRED");
  }

  markFailed(): void {
    this.transitionTo("FAILED");
  }

  // --- Snapshot Export ---

  toData(): CheckoutData {
    return {
      id: this.id,
      storeId: this.storeId,
      cartId: this.cartId,
      customerId: this._customerId,
      email: this._email,
      status: this._status,
      currency: this._currency,
      subtotal: this._subtotal,
      discountTotal: this._discountTotal,
      taxTotal: this._taxTotal,
      shippingTotal: this._shippingTotal,
      total: this._total,
      shippingAddress: this.shippingAddress,
      billingAddress: this.billingAddress,
      paymentStatus: this._paymentStatus,
      expiresAt: this._expiresAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      items: Array.from(this._items.values()).map((item) => item.toData()),
    };
  }
}
