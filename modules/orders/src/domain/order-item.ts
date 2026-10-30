import { generateUuidV7 } from "@calcart/db";
import {
  InvalidMonetaryAmountError,
  InvalidOrderItemError,
  InvalidQuantityError,
} from "./order-errors.js";

export const MAX_MONETARY_AMOUNT = 1_000_000_000_000; // 1 trillion in minor units
export const DEFAULT_MAX_ORDER_ITEM_QUANTITY = 99_999;

export function validateOrderMonetaryAmount(
  amount: unknown,
  fieldName = "Amount",
  allowZero = true,
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
      throw new InvalidMonetaryAmountError(
        `${fieldName} must be greater than zero`,
      );
    }
  }
  if (amount > MAX_MONETARY_AMOUNT) {
    throw new InvalidMonetaryAmountError(
      `${fieldName} exceeds maximum allowable monetary limit`,
    );
  }
  return amount;
}

export function validateOrderItemQuantity(
  quantity: unknown,
  maxQuantity: number = DEFAULT_MAX_ORDER_ITEM_QUANTITY,
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

export interface OrderItemProps {
  id?: string;
  orderId: string;
  storeId: string;
  productId?: string | null;
  variantId?: string | null;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  skuSnapshot?: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxAmount?: number;
  lineTotal?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class OrderItem {
  readonly id: string;
  readonly orderId: string;
  readonly storeId: string;
  readonly productId: string | null;
  readonly variantId: string | null;
  readonly productNameSnapshot: string;
  readonly variantNameSnapshot: string;
  readonly skuSnapshot: string | null;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountAmount: number;
  readonly taxAmount: number;
  readonly lineTotal: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: OrderItemProps) {
    if (!props.orderId || typeof props.orderId !== "string" || props.orderId.trim().length === 0) {
      throw new InvalidOrderItemError("orderId is required for OrderItem");
    }
    if (!props.storeId || typeof props.storeId !== "string" || props.storeId.trim().length === 0) {
      throw new InvalidOrderItemError("storeId is required for OrderItem");
    }
    if (
      !props.productNameSnapshot ||
      typeof props.productNameSnapshot !== "string" ||
      props.productNameSnapshot.trim().length === 0
    ) {
      throw new InvalidOrderItemError(
        "productNameSnapshot is required for OrderItem",
      );
    }
    if (
      !props.variantNameSnapshot ||
      typeof props.variantNameSnapshot !== "string" ||
      props.variantNameSnapshot.trim().length === 0
    ) {
      throw new InvalidOrderItemError(
        "variantNameSnapshot is required for OrderItem",
      );
    }

    this.id = props.id ?? generateUuidV7();
    this.orderId = props.orderId;
    this.storeId = props.storeId;
    this.productId = props.productId ? props.productId.trim() : null;
    this.variantId = props.variantId ? props.variantId.trim() : null;
    this.productNameSnapshot = props.productNameSnapshot.trim();
    this.variantNameSnapshot = props.variantNameSnapshot.trim();
    this.skuSnapshot = props.skuSnapshot ? props.skuSnapshot.trim() : null;

    this.quantity = validateOrderItemQuantity(props.quantity);
    this.unitPrice = validateOrderMonetaryAmount(props.unitPrice, "Unit price", true);
    this.discountAmount = validateOrderMonetaryAmount(
      props.discountAmount ?? 0,
      "Discount amount",
      true,
    );
    this.taxAmount = validateOrderMonetaryAmount(
      props.taxAmount ?? 0,
      "Tax amount",
      true,
    );

    const baseLinePrice = this.quantity * this.unitPrice;
    if (this.discountAmount > baseLinePrice) {
      throw new InvalidMonetaryAmountError(
        "Item discount amount cannot exceed base item price (quantity * unitPrice)",
      );
    }

    const calculatedLineTotal = baseLinePrice - this.discountAmount + this.taxAmount;
    validateOrderMonetaryAmount(calculatedLineTotal, "Calculated line total", true);

    if (props.lineTotal !== undefined && props.lineTotal !== calculatedLineTotal) {
      throw new InvalidMonetaryAmountError(
        `Supplied lineTotal (${props.lineTotal}) does not match calculated line total (${calculatedLineTotal})`,
      );
    }

    this.lineTotal = calculatedLineTotal;
    const now = new Date();
    this.createdAt = props.createdAt ?? now;
    this.updatedAt = props.updatedAt ?? now;
  }
}
