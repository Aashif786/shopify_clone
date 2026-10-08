export type ReservationStatus = "ACTIVE" | "RELEASED" | "COMMITTED";

export type AdjustmentReason =
  | "INITIAL_STOCK"
  | "RESTOCK"
  | "MANUAL_CORRECTION"
  | "DAMAGED"
  | "LOST"
  | "RETURNED"
  | "OTHER";

export interface InventoryItem {
  id: string;
  storeId: string;
  variantId: string;
  availableQuantity: number;
  reservedQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryReservation {
  id: string;
  storeId: string;
  inventoryItemId: string;
  referenceType: string;
  referenceId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryAdjustment {
  id: string;
  storeId: string;
  inventoryItemId: string;
  quantityDelta: number;
  previousQuantity: number;
  newQuantity: number;
  reason: AdjustmentReason;
  referenceType: string | null;
  referenceId: string | null;
  createdBy: string | null;
  createdAt: Date;
}

export interface InventoryAvailability {
  variantId: string;
  availableQuantity: number;
  reservedQuantity: number;
  totalQuantity: number;
  isAvailable: boolean;
}
