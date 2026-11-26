import type { ValidationError, ValidationResult, Validator } from "@calcart/validation";
import { validationFailure, validationSuccess } from "@calcart/validation";

export interface SetStoreTypeDto {
  storeTypeId: string;
  confirmDisableFitCheck?: boolean;
}

export interface SetFitCheckEnabledDto {
  enabled: boolean;
}

export const setStoreTypeValidator: Validator<SetStoreTypeDto> = {
  validate(input: unknown): ValidationResult<SetStoreTypeDto> {
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    const errors: ValidationError[] = [];
    if (typeof record.storeTypeId !== "string" || record.storeTypeId.length === 0) {
      errors.push({ field: "storeTypeId", message: "storeTypeId is required" });
    }
    if (
      record.confirmDisableFitCheck !== undefined &&
      typeof record.confirmDisableFitCheck !== "boolean"
    ) {
      errors.push({
        field: "confirmDisableFitCheck",
        message: "confirmDisableFitCheck must be a boolean",
      });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      storeTypeId: record.storeTypeId as string,
      confirmDisableFitCheck: record.confirmDisableFitCheck as boolean | undefined,
    });
  },
};

export const setFitCheckEnabledValidator: Validator<SetFitCheckEnabledDto> = {
  validate(input: unknown): ValidationResult<SetFitCheckEnabledDto> {
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const { enabled } = input as Record<string, unknown>;
    if (typeof enabled !== "boolean") {
      return validationFailure([{ field: "enabled", message: "enabled must be a boolean" }]);
    }
    return validationSuccess({ enabled });
  },
};

export interface SaveBodyProfileDto {
  heightCm: number;
  weightKg: number;
  chestCm: number;
  waistCm: number;
  hipCm: number;
  unitPreference?: "metric" | "imperial";
  consentAcknowledged?: boolean;
}

const BODY_NUMBER_FIELDS = ["heightCm", "weightKg", "chestCm", "waistCm", "hipCm"] as const;

/** Shape/type validation only; numeric ranges are enforced by the customers module. */
export const saveBodyProfileValidator: Validator<SaveBodyProfileDto> = {
  validate(input: unknown): ValidationResult<SaveBodyProfileDto> {
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    const errors: ValidationError[] = [];
    for (const field of BODY_NUMBER_FIELDS) {
      const value = record[field];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        errors.push({ field, message: `${field} must be a number` });
      }
    }
    if (
      record.unitPreference !== undefined &&
      record.unitPreference !== "metric" &&
      record.unitPreference !== "imperial"
    ) {
      errors.push({ field: "unitPreference", message: "Must be 'metric' or 'imperial'" });
    }
    if (record.consentAcknowledged !== undefined && typeof record.consentAcknowledged !== "boolean") {
      errors.push({ field: "consentAcknowledged", message: "Must be a boolean" });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      heightCm: record.heightCm as number,
      weightKg: record.weightKg as number,
      chestCm: record.chestCm as number,
      waistCm: record.waistCm as number,
      hipCm: record.hipCm as number,
      unitPreference: record.unitPreference as "metric" | "imperial" | undefined,
      consentAcknowledged: record.consentAcknowledged as boolean | undefined,
    });
  },
};
