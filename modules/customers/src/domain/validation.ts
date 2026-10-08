import {
  InvalidAddressError,
  InvalidCustomerEmailError,
  InvalidCustomerStatusError,
} from "./errors.js";
import {
  isValidCustomerStatus,
  type CustomerStatus,
} from "./entities/customer.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  if (typeof email !== "string") {
    throw new InvalidCustomerEmailError("Email must be a string");
  }
  return email.trim().toLowerCase();
}

export function isValidEmailFormat(email: string): boolean {
  if (typeof email !== "string") {
    return false;
  }
  const normalized = email.trim().toLowerCase();
  return EMAIL_REGEX.test(normalized);
}

export function validateCustomerEmail(email: string): string {
  if (typeof email !== "string" || !email.trim()) {
    throw new InvalidCustomerEmailError("Customer email is required");
  }

  const trimmed = email.trim();
  if (trimmed.length > 255) {
    throw new InvalidCustomerEmailError(
      "Customer email cannot exceed 255 characters",
    );
  }

  const normalized = normalizeEmail(trimmed);
  if (!EMAIL_REGEX.test(normalized)) {
    throw new InvalidCustomerEmailError(
      `Invalid customer email format: '${trimmed}'`,
    );
  }

  return normalized;
}

export function validateCustomerStatus(status: unknown): CustomerStatus {
  if (!isValidCustomerStatus(status)) {
    throw new InvalidCustomerStatusError(
      `Invalid customer status: '${String(status)}'. Must be 'ACTIVE' or 'DISABLED'.`,
    );
  }
  return status;
}

export function validateCustomerName(
  name: string | null | undefined,
  fieldName = "Name",
): string | null {
  if (name === null || name === undefined) {
    return null;
  }
  if (typeof name !== "string") {
    throw new InvalidAddressError(`${fieldName} must be a string`);
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > 100) {
    throw new InvalidAddressError(
      `${fieldName} cannot exceed 100 characters`,
    );
  }
  return trimmed;
}

export function validateCustomerPhone(
  phone: string | null | undefined,
): string | null {
  if (phone === null || phone === undefined) {
    return null;
  }
  if (typeof phone !== "string") {
    throw new InvalidAddressError("Phone must be a string");
  }
  const trimmed = phone.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > 50) {
    throw new InvalidAddressError("Phone cannot exceed 50 characters");
  }
  return trimmed;
}

export function validateAddressLine(
  line: string,
  fieldName = "Address line 1",
): string {
  if (typeof line !== "string" || !line.trim()) {
    throw new InvalidAddressError(`${fieldName} is required`);
  }
  const trimmed = line.trim();
  if (trimmed.length > 255) {
    throw new InvalidAddressError(
      `${fieldName} cannot exceed 255 characters`,
    );
  }
  return trimmed;
}

export function validateCity(city: string): string {
  if (typeof city !== "string" || !city.trim()) {
    throw new InvalidAddressError("City is required");
  }
  const trimmed = city.trim();
  if (trimmed.length > 100) {
    throw new InvalidAddressError("City cannot exceed 100 characters");
  }
  return trimmed;
}

export function validateState(state: string | null | undefined): string | null {
  if (state === null || state === undefined) {
    return null;
  }
  if (typeof state !== "string") {
    throw new InvalidAddressError("State must be a string");
  }
  const trimmed = state.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > 100) {
    throw new InvalidAddressError("State cannot exceed 100 characters");
  }
  return trimmed;
}

export function validatePostalCode(code: string): string {
  if (typeof code !== "string" || !code.trim()) {
    throw new InvalidAddressError("Postal code is required");
  }
  const trimmed = code.trim();
  if (trimmed.length > 32) {
    throw new InvalidAddressError("Postal code cannot exceed 32 characters");
  }
  return trimmed;
}

export function validateCountryCode(country: string): string {
  if (typeof country !== "string" || !country.trim()) {
    throw new InvalidAddressError("Country is required");
  }
  const trimmed = country.trim().toUpperCase();
  if (trimmed.length > 64) {
    throw new InvalidAddressError("Country cannot exceed 64 characters");
  }
  return trimmed;
}

export function validateOptionalAddressLine(
  line: string | null | undefined,
  fieldName = "Address line 2",
): string | null {
  if (line === null || line === undefined) {
    return null;
  }
  if (typeof line !== "string") {
    throw new InvalidAddressError(`${fieldName} must be a string`);
  }
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > 255) {
    throw new InvalidAddressError(`${fieldName} cannot exceed 255 characters`);
  }
  return trimmed;
}
