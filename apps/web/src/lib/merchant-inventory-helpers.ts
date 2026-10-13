import type { AdjustmentReason } from "@shopify-clone/inventory";

export type { AdjustmentReason };

export interface InventoryVariantItem {
  variantId: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  variantTitle: string;
  sku: string | null;
  price: number;
  currency: string;
  availableQuantity: number;
  reservedQuantity: number;
  totalQuantity: number;
  isInitialized: boolean;
  inventoryItemId?: string | null;
}

export interface StockAdjustmentFormData {
  direction: "add" | "remove";
  quantity: string;
  reason: AdjustmentReason;
  referenceType: string;
  referenceId: string;
}

export const INITIAL_ADJUSTMENT_DATA: StockAdjustmentFormData = {
  direction: "add",
  quantity: "1",
  reason: "RESTOCK",
  referenceType: "",
  referenceId: "",
};

export interface AdjustmentReasonConfig {
  value: AdjustmentReason;
  label: string;
  defaultDirection: "add" | "remove";
  description: string;
}

export const ADJUSTMENT_REASONS_CONFIG: AdjustmentReasonConfig[] = [
  {
    value: "RESTOCK",
    label: "Restock / Inbound Shipment",
    defaultDirection: "add",
    description: "Receive incoming purchase orders or warehouse stock replenishment.",
  },
  {
    value: "INITIAL_STOCK",
    label: "Initial Stock Intake",
    defaultDirection: "add",
    description: "Opening inventory count for newly added variants.",
  },
  {
    value: "RETURNED",
    label: "Customer Return",
    defaultDirection: "add",
    description: "Restock goods returned by customers in good condition.",
  },
  {
    value: "MANUAL_CORRECTION",
    label: "Manual Audit / Cycle Count",
    defaultDirection: "add",
    description: "Routine reconciliation following a physical count.",
  },
  {
    value: "DAMAGED",
    label: "Damaged Stock",
    defaultDirection: "remove",
    description: "Deduct items damaged in warehouse or transit.",
  },
  {
    value: "LOST",
    label: "Lost / Shrinkage",
    defaultDirection: "remove",
    description: "Deduct missing or unaccounted inventory items.",
  },
  {
    value: "OTHER",
    label: "Other Operational Adjustment",
    defaultDirection: "add",
    description: "Miscellaneous operational inventory change.",
  },
];

export function validateStockAdjustmentInput(
  data: StockAdjustmentFormData,
  currentAvailable: number,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const qtyNum = Number(data.quantity);

  if (!data.quantity || !Number.isInteger(qtyNum) || qtyNum <= 0) {
    errors.quantity = "Quantity must be a positive whole number greater than 0";
  } else if (data.direction === "remove" && qtyNum > currentAvailable) {
    errors.quantity = `Cannot remove ${qtyNum} units: only ${currentAvailable} units currently available`;
  }

  const validReasons = ADJUSTMENT_REASONS_CONFIG.map((r) => r.value);
  if (!validReasons.includes(data.reason)) {
    errors.reason = "Please select a valid adjustment reason";
  }

  if (data.referenceType.trim().length > 50) {
    errors.referenceType = "Reference type must not exceed 50 characters";
  }

  if (data.referenceId.trim().length > 100) {
    errors.referenceId = "Reference ID must not exceed 100 characters";
  }

  return errors;
}

export function calculateSignedDelta(
  direction: "add" | "remove",
  quantity: number,
): number {
  return direction === "add" ? Math.abs(quantity) : -Math.abs(quantity);
}

export function getStockStatus(
  available: number,
): "in_stock" | "low_stock" | "out_of_stock" {
  if (available <= 0) return "out_of_stock";
  if (available <= 5) return "low_stock";
  return "in_stock";
}

export interface InventoryKpis {
  totalVariants: number;
  totalAvailable: number;
  totalReserved: number;
  outOfStockCount: number;
  lowStockCount: number;
}

export function calculateInventoryKpis(
  items: InventoryVariantItem[],
): InventoryKpis {
  let totalAvailable = 0;
  let totalReserved = 0;
  let outOfStockCount = 0;
  let lowStockCount = 0;

  for (const item of items) {
    totalAvailable += item.availableQuantity;
    totalReserved += item.reservedQuantity;
    if (item.availableQuantity <= 0) {
      outOfStockCount += 1;
    } else if (item.availableQuantity <= 5) {
      lowStockCount += 1;
    }
  }

  return {
    totalVariants: items.length,
    totalAvailable,
    totalReserved,
    outOfStockCount,
    lowStockCount,
  };
}

export function formatAdjustmentReason(reason: string): string {
  const match = ADJUSTMENT_REASONS_CONFIG.find((r) => r.value === reason);
  if (match) return match.label;
  return reason.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
