export {
  type ReservationStatus,
  type AdjustmentReason,
  type InventoryItem,
  type InventoryReservation,
  type InventoryAdjustment,
  type InventoryAvailability,
} from "./domain/entities.js";

export {
  InventoryDomainError,
  InventoryNotFoundError,
  ReservationNotFoundError,
  InvalidInventoryQuantityError,
  InsufficientStockError,
  InvalidReservationStateTransitionError,
  InvalidAdjustmentReasonError,
  CrossStoreInventoryAccessError,
  DuplicateReservationError,
} from "./domain/errors.js";

export {
  VALID_RESERVATION_TRANSITIONS,
  isValidReservationTransition,
  assertValidReservationTransition,
  isTerminalReservationStatus,
} from "./domain/lifecycle.js";

export {
  ADJUSTMENT_REASONS,
  RESERVATION_STATUSES,
  validateQuantity,
  validatePositiveQuantity,
  validateQuantityDelta,
  validateAdjustmentReason,
  validateReservationStatus,
  validateReference,
  calculateTotalQuantity,
} from "./domain/validation.js";

export { InventoryRepository } from "./infrastructure/inventory-repository.js";

export { InventoryService } from "./application/inventory-service.js";
export {
  ReservationReleaseService,
  type ReleaseOrderReservationsInput,
  type ReleaseOrderReservationsResult,
} from "./application/reservation-release-service.js";

export type {
  AdjustInventoryInput,
  ReserveInventoryItemInput,
  ReserveInventoryInput,
  ReserveManyInventoryInput,
  InventoryItemDTO,
  InventoryReservationDTO,
  InventoryAdjustmentDTO,
  InventoryAvailabilityDTO,
  StoreInventoryItemDTO,
  ListStoreInventoryFilter,
} from "./application/dtos.js";
