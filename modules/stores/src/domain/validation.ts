import type { StoreRole } from "@shopify-clone/tenant";
import type { ValidationError } from "@shopify-clone/validation";

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;
const LOCALE_REGEX = /^[a-z]{2,3}(-[A-Za-z0-9]{2,4})?$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isValidSlugFormat(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 63 && SLUG_REGEX.test(slug);
}

export function isValidCurrency(currency: string): boolean {
  return CURRENCY_REGEX.test(currency.toUpperCase());
}

export function isValidLocale(locale: string): boolean {
  return LOCALE_REGEX.test(locale);
}

export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function isValidStoreRole(role: string): role is StoreRole {
  return role === "owner" || role === "admin" || role === "staff";
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface ValidateStoreInputOptions {
  name: string;
  slug?: string;
  currency?: string;
  locale?: string;
  timezone?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export function validateStoreInput(
  input: ValidateStoreInputOptions,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!input.name || !input.name.trim()) {
    errors.push({ field: "name", message: "Store name is required" });
  } else if (input.name.trim().length > 100) {
    errors.push({
      field: "name",
      message: "Store name must not exceed 100 characters",
    });
  }

  if (input.slug !== undefined) {
    const slug = input.slug.trim();
    if (!slug) {
      errors.push({ field: "slug", message: "Store slug cannot be empty" });
    } else if (!isValidSlugFormat(slug)) {
      errors.push({
        field: "slug",
        message:
          "Slug must be 3-63 characters and contain only lowercase letters, numbers, and hyphens",
      });
    }
  }

  if (input.currency !== undefined) {
    if (!isValidCurrency(input.currency)) {
      errors.push({
        field: "currency",
        message:
          "Currency must be a valid 3-letter ISO code (e.g. USD, EUR, INR)",
      });
    }
  }

  if (input.locale !== undefined) {
    if (!isValidLocale(input.locale)) {
      errors.push({
        field: "locale",
        message: "Locale must be a valid code (e.g. en-US, de-DE)",
      });
    }
  }

  if (input.timezone !== undefined) {
    if (!isValidTimezone(input.timezone)) {
      errors.push({
        field: "timezone",
        message:
          "Timezone must be a valid IANA timezone identifier (e.g. UTC, America/New_York)",
      });
    }
  }

  if (input.contactEmail) {
    if (!isValidEmail(input.contactEmail.trim())) {
      errors.push({
        field: "contactEmail",
        message: "Contact email must be a valid email address",
      });
    }
  }

  if (input.contactPhone && input.contactPhone.length > 30) {
    errors.push({
      field: "contactPhone",
      message: "Contact phone must not exceed 30 characters",
    });
  }

  return errors;
}
