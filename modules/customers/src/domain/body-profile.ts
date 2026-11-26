import { CustomerDomainError } from "./errors.js";

export type BodyUnitPreference = "metric" | "imperial";

/** Measurements are always stored in metric units; the unit preference only affects display. */
export interface CustomerBodyProfile {
  id: string;
  storeId: string;
  customerId: string;
  heightCm: number;
  weightKg: number;
  chestCm: number;
  waistCm: number;
  hipCm: number;
  unitPreference: BodyUnitPreference;
  consentAcknowledgedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BodyProfileMeasurements {
  heightCm: number;
  weightKg: number;
  chestCm: number;
  waistCm: number;
  hipCm: number;
}

export interface BodyProfileDTO extends BodyProfileMeasurements {
  unitPreference: BodyUnitPreference;
  consentAcknowledgedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveBodyProfileInput extends BodyProfileMeasurements {
  unitPreference?: BodyUnitPreference;
  /** Must be true the first time a profile is created. */
  consentAcknowledged?: boolean;
}

export interface MeasurementRange {
  min: number;
  max: number;
  label: string;
}

/** Ranges mirror the CHECK constraints in migration 0059. */
export const BODY_MEASUREMENT_RANGES: Record<keyof BodyProfileMeasurements, MeasurementRange> = {
  heightCm: { min: 100, max: 250, label: "Height" },
  weightKg: { min: 25, max: 300, label: "Weight" },
  chestCm: { min: 50, max: 200, label: "Chest" },
  waistCm: { min: 40, max: 200, label: "Waist" },
  hipCm: { min: 50, max: 220, label: "Hip" },
};

export class InvalidBodyProfileError extends CustomerDomainError {
  constructor(message: string, details?: unknown) {
    super(message, "INVALID_BODY_PROFILE", 400, details);
  }
}

export class BodyProfileNotFoundError extends CustomerDomainError {
  constructor() {
    super("No body profile found", "BODY_PROFILE_NOT_FOUND", 404);
  }
}

export class BodyProfileConsentRequiredError extends CustomerDomainError {
  constructor() {
    super(
      "You must acknowledge how your measurements are used before saving a body profile",
      "BODY_PROFILE_CONSENT_REQUIRED",
      400,
    );
  }
}

/** Throws InvalidBodyProfileError listing every invalid field. */
export function assertValidBodyMeasurements(input: BodyProfileMeasurements): void {
  const fields: Record<string, string> = {};
  for (const key of Object.keys(BODY_MEASUREMENT_RANGES) as Array<keyof BodyProfileMeasurements>) {
    const range = BODY_MEASUREMENT_RANGES[key];
    const value = input[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      fields[key] = `${range.label} must be a number`;
    } else if (value < range.min || value > range.max) {
      fields[key] = `${range.label} must be between ${range.min} and ${range.max}`;
    }
  }
  if (Object.keys(fields).length > 0) {
    throw new InvalidBodyProfileError("Invalid body measurements", { fields });
  }
}

export function isBodyUnitPreference(value: unknown): value is BodyUnitPreference {
  return value === "metric" || value === "imperial";
}

export function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
