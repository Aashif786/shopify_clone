import type {
  AdjustmentReason,
  ReservationStatus,
} from "../domain/entities.js";

export interface AdjustInventoryInput {
  quantityDelta: number;
  reason: AdjustmentReason;
  referenceType?: string | null;
  referenceId?: string | null;
  createdBy?: string | null;
}

export interface ReserveInventoryItemInput {
  variantId: string;
  quantity: number;
}

export interface ReserveInventoryInput {
  variantId: string;
  quantity: number;
  referenceType: string;
  referenceId: string;
  expiresAt?: Date | null;
}

export interface ReserveManyInventoryInput {
  items: ReserveInventoryItemInput[];
  referenceType: string;
  referenceId: string;
  expiresAt?: Date | null;
}

export interface InventoryItemDTO {
  id: string;
  storeId: string;
  variantId: string;
  availableQuantity: number;
  reservedQuantity: number;
  totalQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryReservationDTO {
  id: string;
  storeId: string;
  inventoryItemId: string;
  referenceType: string;
  referenceId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryAdjustmentDTO {
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
  createdAt: string;
}

export interface InventoryAvailabilityDTO {
  variantId: string;
  availableQuantity: number;
  reservedQuantity: number;
  totalQuantity: number;
  isAvailable: boolean;
}
