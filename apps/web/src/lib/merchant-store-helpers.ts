export interface StoreFormData {
  name: string;
  slug: string;
  currency: string;
  locale: string;
  timezone: string;
  contactEmail: string;
  contactPhone: string;
  description: string;
}

export const INITIAL_STORE_FORM_DATA: StoreFormData = {
  name: "",
  slug: "",
  currency: "USD",
  locale: "en-US",
  timezone: "UTC",
  contactEmail: "",
  contactPhone: "",
  description: "",
};

export interface CurrencyOption {
  value: string;
  label: string;
}

export const COMMON_CURRENCIES: CurrencyOption[] = [
  { value: "USD", label: "USD - US Dollar ($)" },
  { value: "EUR", label: "EUR - Euro (€)" },
  { value: "GBP", label: "GBP - British Pound (£)" },
  { value: "CAD", label: "CAD - Canadian Dollar (CA$)" },
  { value: "AUD", label: "AUD - Australian Dollar (A$)" },
  { value: "INR", label: "INR - Indian Rupee (₹)" },
  { value: "JPY", label: "JPY - Japanese Yen (¥)" },
];

export interface LocaleOption {
  value: string;
  label: string;
}

export const COMMON_LOCALES: LocaleOption[] = [
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-CA", label: "English (Canada)" },
  { value: "de-DE", label: "German (Germany)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "ja-JP", label: "Japanese (Japan)" },
];

export interface TimezoneOption {
  value: string;
  label: string;
}

export const COMMON_TIMEZONES: TimezoneOption[] = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "America/New_York (Eastern Time)" },
  { value: "America/Chicago", label: "America/Chicago (Central Time)" },
  { value: "America/Denver", label: "America/Denver (Mountain Time)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (Pacific Time)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST)" },
];

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CURRENCY_REGEX = /^[A-Za-z]{3}$/;
const LOCALE_REGEX = /^[a-z]{2,3}(-[A-Za-z0-9]{2,4})?$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalizes input string to a slug compliant with the domain model:
 * lowercases, replaces non-alphanumeric chars with hyphens, collapses consecutive hyphens,
 * and strips leading/trailing hyphens.
 */
export function normalizeSlugInput(raw: string): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Validates slug format according to backend domain invariants:
 * 3 to 63 chars, alphanumeric with single internal hyphens.
 */
export function isValidSlugFormat(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 63 && SLUG_REGEX.test(slug);
}

/**
 * Validates store creation form data on the client side before submission.
 * Returns an object mapping invalid field names to user-friendly error messages.
 */
export function validateStoreFormData(
  data: StoreFormData,
): Record<string, string> {
  const errors: Record<string, string> = {};

  const trimmedName = data.name.trim();
  if (!trimmedName) {
    errors.name = "Store name is required";
  } else if (trimmedName.length > 100) {
    errors.name = "Store name must not exceed 100 characters";
  }

  const trimmedSlug = data.slug.trim();
  if (trimmedSlug) {
    if (!isValidSlugFormat(trimmedSlug)) {
      errors.slug =
        "Slug must be 3-63 characters and contain only lowercase letters, numbers, and hyphens";
    }
  }

  const trimmedCurrency = data.currency.trim();
  if (trimmedCurrency) {
    if (!CURRENCY_REGEX.test(trimmedCurrency)) {
      errors.currency = "Currency must be a 3-letter currency code (e.g. USD, EUR, INR)";
    }
  }

  const trimmedLocale = data.locale.trim();
  if (trimmedLocale) {
    if (!LOCALE_REGEX.test(trimmedLocale)) {
      errors.locale = "Locale must be a valid locale code (e.g. en-US, de-DE)";
    }
  }

  const trimmedEmail = data.contactEmail.trim();
  if (trimmedEmail) {
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.contactEmail = "Contact email must be a valid email address";
    }
  }

  const trimmedPhone = data.contactPhone.trim();
  if (trimmedPhone && trimmedPhone.length > 30) {
    errors.contactPhone = "Contact phone must not exceed 30 characters";
  }

  return errors;
}

export interface CreateStorePayload {
  name: string;
  slug?: string;
  currency?: string;
  locale?: string;
  timezone?: string;
  contactEmail?: string;
  contactPhone?: string;
  description?: string;
}

/**
 * Converts validated form state into the API request payload expected by POST /api/v1/stores.
 */
export function formDataToStorePayload(data: StoreFormData): CreateStorePayload {
  const payload: CreateStorePayload = {
    name: data.name.trim(),
  };

  const trimmedSlug = data.slug.trim();
  if (trimmedSlug) {
    payload.slug = normalizeSlugInput(trimmedSlug);
  }

  const trimmedCurrency = data.currency.trim();
  if (trimmedCurrency) {
    payload.currency = trimmedCurrency.toUpperCase();
  }

  const trimmedLocale = data.locale.trim();
  if (trimmedLocale) {
    payload.locale = trimmedLocale;
  }

  const trimmedTimezone = data.timezone.trim();
  if (trimmedTimezone) {
    payload.timezone = trimmedTimezone;
  }

  const trimmedEmail = data.contactEmail.trim();
  if (trimmedEmail) {
    payload.contactEmail = trimmedEmail;
  }

  const trimmedPhone = data.contactPhone.trim();
  if (trimmedPhone) {
    payload.contactPhone = trimmedPhone;
  }

  const trimmedDesc = data.description.trim();
  if (trimmedDesc) {
    payload.description = trimmedDesc;
  }

  return payload;
}
