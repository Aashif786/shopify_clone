import { InvalidStoreTypeError } from "./store-type-errors.js";

export interface StoreType {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isFashion: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreTypeDTO {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isFashion: boolean;
  storeCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoreTypeInput {
  key: string;
  name: string;
  description?: string | null;
  isFashion?: boolean;
}

export interface UpdateStoreTypeInput {
  key?: string;
  name?: string;
  description?: string | null;
  isFashion?: boolean;
}

export interface StoreClassificationDTO {
  storeId: string;
  storeType: StoreTypeDTO;
  fitCheckEligible: boolean;
  fitCheckEnabled: boolean;
  /** True only when the store type is fashion AND the merchant enabled Fit Check. */
  fitCheckActive: boolean;
}

export const STORE_TYPE_KEY_PATTERN = /^[a-z0-9]+(_[a-z0-9]+)*$/;

export function normalizeStoreTypeKey(key: string): string {
  return key.trim().toLowerCase();
}

export function assertValidStoreTypeKey(key: string): void {
  if (key.length === 0 || key.length > 64 || !STORE_TYPE_KEY_PATTERN.test(key)) {
    throw new InvalidStoreTypeError(
      "Store type key must be lowercase letters and digits separated by single underscores (max 64 characters)",
      { field: "key" },
    );
  }
}

export function assertValidStoreTypeName(name: string): void {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 120) {
    throw new InvalidStoreTypeError("Store type name must be 1-120 characters", {
      field: "name",
    });
  }
}

export function assertValidStoreTypeDescription(
  description: string | null | undefined,
): void {
  if (description && description.length > 500) {
    throw new InvalidStoreTypeError(
      "Store type description must be at most 500 characters",
      { field: "description" },
    );
  }
}
