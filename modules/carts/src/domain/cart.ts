import { generateUuidV7 } from "@shopify-clone/db";
import {
  CartDomainError,
  CartItemNotFoundError,
  InvalidCartPriceError,
  InvalidCurrencyError,
  InvalidQuantityError,
} from "./cart-errors.js";
import {
  assertCartEditable,
  assertValidCartTransition,
  type CartStatus,
} from "./cart-state.js";
import {
  calculateLineSubtotal,
  createCartItem,
  validateCartQuantity,
  validateCartUnitPrice,
  type CartItem,
} from "./cart-item.js";

export const DEFAULT_CART_CURRENCY = "USD";

export function validateCartCurrency(currency: unknown): string {
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

export function validateMonetaryAmount(
  amount: unknown,
  fieldName = "Amount",
): number {
  if (
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    Number.isNaN(amount)
  ) {
    throw new InvalidCartPriceError(`${fieldName} must be an integer minor units (e.g. cents)`);
  }
  if (amount < 0) {
    throw new InvalidCartPriceError(`${fieldName} cannot be negative`);
  }
  return amount;
}

export interface CartData {
  id: string;
  storeId: string;
  customerId: string | null;
  guestIdentifier: string | null;
  status: CartStatus;
  currency: string;
  subtotal: number;
  discountTotal: number;
  discountId: string | null;
  discountCode: string | null;
  taxTotal: number;
  shippingTotal: number;
  grandTotal: number;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCartParams {
  id?: string;
  storeId: string;
  customerId?: string | null;
  guestIdentifier?: string | null;
  currency?: string;
  discountId?: string | null;
  discountCode?: string | null;
  expiresAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ReconstituteCartParams {
  id: string;
  storeId: string;
  customerId: string | null;
  guestIdentifier: string | null;
  status: CartStatus;
  currency: string;
  subtotal: number;
  discountTotal: number;
  discountId: string | null;
  discountCode: string | null;
  taxTotal: number;
  shippingTotal: number;
  grandTotal: number;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items?: CartItem[];
}

export interface AddItemParams {
  id?: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
}

export class Cart {
  readonly id: string;
  readonly storeId: string;
  private _customerId: string | null;
  private _guestIdentifier: string | null;
  private _status: CartStatus;
  private _currency: string;
  private _subtotal: number;
  private _discountTotal: number;
  private _discountId: string | null;
  private _discountCode: string | null;
  private _taxTotal: number;
  private _shippingTotal: number;
  private _grandTotal: number;
  private _expiresAt: Date | null;
  private _createdAt: Date;
  private _updatedAt: Date;
  private readonly _items: Map<string, CartItem>; // Keyed by variantId

  private constructor(params: ReconstituteCartParams) {
    this.id = params.id;
    this.storeId = params.storeId;
    this._customerId = params.customerId ?? null;
    this._guestIdentifier = params.guestIdentifier ?? null;
    this._status = params.status;
    this._currency = validateCartCurrency(params.currency);
    this._subtotal = validateMonetaryAmount(params.subtotal, "Subtotal");
    this._discountTotal = validateMonetaryAmount(params.discountTotal, "Discount total");
    this._discountId = params.discountId ?? null;
    this._discountCode = params.discountCode ?? null;
    this._taxTotal = validateMonetaryAmount(params.taxTotal, "Tax total");
    this._shippingTotal = validateMonetaryAmount(params.shippingTotal, "Shipping total");
    this._grandTotal = validateMonetaryAmount(params.grandTotal, "Grand total");
    this._expiresAt = params.expiresAt ?? null;
    this._createdAt = params.createdAt;
    this._updatedAt = params.updatedAt;
    this._items = new Map();

    if (params.items) {
      for (const item of params.items) {
        this._items.set(item.variantId, item);
      }
    }
  }

  static create(params: CreateCartParams): Cart {
    const now = new Date();
    const currency = validateCartCurrency(params.currency ?? DEFAULT_CART_CURRENCY);

    return new Cart({
      id: params.id ?? generateUuidV7(),
      storeId: params.storeId,
      customerId: params.customerId ?? null,
      guestIdentifier: params.guestIdentifier ?? null,
      status: "ACTIVE",
      currency,
      subtotal: 0,
      discountTotal: 0,
      discountId: params.discountId ?? null,
      discountCode: params.discountCode ?? null,
      taxTotal: 0,
      shippingTotal: 0,
      grandTotal: 0,
      expiresAt: params.expiresAt ?? null,
      createdAt: params.createdAt ?? now,
      updatedAt: params.updatedAt ?? now,
      items: [],
    });
  }

  static reconstitute(params: ReconstituteCartParams): Cart {
    return new Cart(params);
  }

  get customerId(): string | null {
    return this._customerId;
  }

  get guestIdentifier(): string | null {
    return this._guestIdentifier;
  }

  get status(): CartStatus {
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

  get discountId(): string | null {
    return this._discountId;
  }

  get discountCode(): string | null {
    return this._discountCode;
  }

  get taxTotal(): number {
    return this._taxTotal;
  }

  get shippingTotal(): number {
    return this._shippingTotal;
  }

  get grandTotal(): number {
    return this._grandTotal;
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

  get items(): CartItem[] {
    return Array.from(this._items.values());
  }

  getItem(variantId: string): CartItem | undefined {
    return this._items.get(variantId);
  }

  getItemById(itemId: string): CartItem | undefined {
    for (const item of this._items.values()) {
      if (item.id === itemId) {
        return item;
      }
    }
    return undefined;
  }

  addItem(params: AddItemParams): CartItem {
    assertCartEditable(this._status);

    const quantity = validateCartQuantity(params.quantity);
    const unitPrice = validateCartUnitPrice(params.unitPrice);
    const existing = this._items.get(params.variantId);

    if (existing) {
      const newQuantity = existing.quantity + quantity;
      validateCartQuantity(newQuantity);
      const newLineSubtotal = calculateLineSubtotal(newQuantity, unitPrice);
      const now = new Date();

      const updatedItem: CartItem = {
        ...existing,
        quantity: newQuantity,
        unitPrice,
        lineSubtotal: newLineSubtotal,
        updatedAt: now,
      };

      this._items.set(params.variantId, updatedItem);
      this.recalculateTotals();
      return updatedItem;
    }

    const newItem = createCartItem({
      id: params.id,
      cartId: this.id,
      storeId: this.storeId,
      variantId: params.variantId,
      quantity,
      unitPrice,
    });

    this._items.set(params.variantId, newItem);
    this.recalculateTotals();
    return newItem;
  }

  updateItemQuantity(variantId: string, quantity: number): CartItem | null {
    assertCartEditable(this._status);

    if (typeof quantity !== "number" || !Number.isInteger(quantity) || Number.isNaN(quantity)) {
      throw new InvalidQuantityError("Quantity must be a valid integer");
    }

    if (quantity < 0) {
      throw new InvalidQuantityError("Quantity cannot be negative");
    }

    if (quantity === 0) {
      this.removeItem(variantId);
      return null;
    }

    validateCartQuantity(quantity);
    const item = this._items.get(variantId);
    if (!item) {
      throw new CartItemNotFoundError(`Cart item for variant '${variantId}' not found in cart`);
    }

    const newLineSubtotal = calculateLineSubtotal(quantity, item.unitPrice);
    const updatedItem: CartItem = {
      ...item,
      quantity,
      lineSubtotal: newLineSubtotal,
      updatedAt: new Date(),
    };

    this._items.set(variantId, updatedItem);
    this.recalculateTotals();
    return updatedItem;
  }

  removeItem(variantId: string): void {
    assertCartEditable(this._status);

    if (!this._items.has(variantId)) {
      throw new CartItemNotFoundError(`Cart item for variant '${variantId}' not found in cart`);
    }

    this._items.delete(variantId);
    this.recalculateTotals();
  }

  removeItemById(itemId: string): void {
    assertCartEditable(this._status);

    let foundVariantId: string | undefined;
    for (const [vId, item] of this._items.entries()) {
      if (item.id === itemId) {
        foundVariantId = vId;
        break;
      }
    }

    if (!foundVariantId) {
      throw new CartItemNotFoundError(`Cart item with id '${itemId}' not found in cart`);
    }

    this._items.delete(foundVariantId);
    this.recalculateTotals();
  }

  clear(): void {
    assertCartEditable(this._status);
    this._items.clear();
    this.recalculateTotals();
  }

  assignCustomer(customerId: string): void {
    assertCartEditable(this._status);
    if (!customerId || customerId.trim().length === 0) {
      throw new CartDomainError(
        "Customer ID cannot be empty",
        "INVALID_CUSTOMER_ID",
        400,
      );
    }
    this._customerId = customerId;
    this._updatedAt = new Date();
  }

  removeCustomer(): void {
    assertCartEditable(this._status);
    this._customerId = null;
    this._updatedAt = new Date();
  }

  assignGuest(guestIdentifier: string): void {
    assertCartEditable(this._status);
    if (!guestIdentifier || guestIdentifier.trim().length === 0) {
      throw new CartDomainError(
        "Guest identifier cannot be empty",
        "INVALID_GUEST_IDENTIFIER",
        400,
      );
    }
    this._guestIdentifier = guestIdentifier;
    this._updatedAt = new Date();
  }

  setTotals(totals: {
    discountTotal?: number;
    discountId?: string | null;
    discountCode?: string | null;
    taxTotal?: number;
    shippingTotal?: number;
  }): void {
    assertCartEditable(this._status);

    if (totals.discountTotal !== undefined) {
      this._discountTotal = validateMonetaryAmount(totals.discountTotal, "Discount total");
    }
    if (totals.discountId !== undefined) {
      this._discountId = totals.discountId;
    }
    if (totals.discountCode !== undefined) {
      this._discountCode = totals.discountCode ? totals.discountCode.trim().toUpperCase() : null;
    }
    if (totals.taxTotal !== undefined) {
      this._taxTotal = validateMonetaryAmount(totals.taxTotal, "Tax total");
    }
    if (totals.shippingTotal !== undefined) {
      this._shippingTotal = validateMonetaryAmount(totals.shippingTotal, "Shipping total");
    }

    this.recalculateTotals();
  }

  transitionTo(newStatus: CartStatus): void {
    assertValidCartTransition(this._status, newStatus);
    this._status = newStatus;
    this._updatedAt = new Date();
  }

  markConverted(): void {
    this.transitionTo("CONVERTED");
  }

  markAbandoned(): void {
    this.transitionTo("ABANDONED");
  }

  markExpired(): void {
    this.transitionTo("EXPIRED");
  }

  recalculateTotals(): void {
    this._subtotal = Array.from(this._items.values()).reduce(
      (sum, item) => sum + item.lineSubtotal,
      0,
    );
    this._grandTotal = Math.max(
      0,
      this._subtotal - this._discountTotal + this._taxTotal + this._shippingTotal,
    );
    this._updatedAt = new Date();
  }

  toData(): CartData & { items: CartItem[] } {
    return {
      id: this.id,
      storeId: this.storeId,
      customerId: this._customerId,
      guestIdentifier: this._guestIdentifier,
      status: this._status,
      currency: this._currency,
      subtotal: this._subtotal,
      discountTotal: this._discountTotal,
      discountId: this._discountId,
      discountCode: this._discountCode,
      taxTotal: this._taxTotal,
      shippingTotal: this._shippingTotal,
      grandTotal: this._grandTotal,
      expiresAt: this._expiresAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      items: this.items,
    };
  }
}
