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

export interface StoreSettingsFormData {
  name: string;
  currency: string;
  locale: string;
  timezone: string;
  contactEmail: string;
  contactPhone: string;
  description: string;
}

export interface StoreSettingsDetail {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  currency: string;
  locale: string;
  timezone: string;
  settings: {
    contactEmail: string | null;
    contactPhone: string | null;
    description: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Converts a StoreDetailDTO into form values for editing settings.
 */
export function storeDetailToSettingsFormData(
  store: StoreSettingsDetail,
): StoreSettingsFormData {
  return {
    name: store.name || "",
    currency: store.currency || "USD",
    locale: store.locale || "en-US",
    timezone: store.timezone || "UTC",
    contactEmail: store.settings?.contactEmail || "",
    contactPhone: store.settings?.contactPhone || "",
    description: store.settings?.description || "",
  };
}

/**
 * Validates store settings form values, taking into account immutable currency rules after activation.
 */
export function validateStoreSettings(
  data: StoreSettingsFormData,
  currentStatus: string,
  initialData?: StoreSettingsFormData,
): Record<string, string> {
  const errors: Record<string, string> = {};

  const trimmedName = data.name.trim();
  if (!trimmedName) {
    errors.name = "Store name is required";
  } else if (trimmedName.length > 100) {
    errors.name = "Store name must not exceed 100 characters";
  }

  const trimmedCurrency = data.currency.trim();
  if (trimmedCurrency) {
    if (!CURRENCY_REGEX.test(trimmedCurrency)) {
      errors.currency = "Currency must be a 3-letter currency code (e.g. USD, EUR, INR)";
    } else if (
      currentStatus !== "DRAFT" &&
      initialData &&
      trimmedCurrency.toUpperCase() !== initialData.currency.toUpperCase()
    ) {
      errors.currency = "Store currency cannot be modified once the store has been activated";
    }
  }

  const trimmedLocale = data.locale.trim();
  if (trimmedLocale && !LOCALE_REGEX.test(trimmedLocale)) {
    errors.locale = "Locale must be a valid locale code (e.g. en-US, de-DE)";
  }

  const trimmedEmail = data.contactEmail.trim();
  if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
    errors.contactEmail = "Contact email must be a valid email address";
  }

  const trimmedPhone = data.contactPhone.trim();
  if (trimmedPhone && trimmedPhone.length > 30) {
    errors.contactPhone = "Contact phone must not exceed 30 characters";
  }

  return errors;
}

/**
 * Checks whether the current form values differ from the initial persisted store values.
 */
export function hasUnsavedSettingsChanges(
  current: StoreSettingsFormData,
  initial: StoreSettingsFormData,
): boolean {
  return (
    current.name.trim() !== initial.name.trim() ||
    current.currency.trim().toUpperCase() !== initial.currency.trim().toUpperCase() ||
    current.locale.trim() !== initial.locale.trim() ||
    current.timezone.trim() !== initial.timezone.trim() ||
    current.contactEmail.trim() !== initial.contactEmail.trim() ||
    current.contactPhone.trim() !== initial.contactPhone.trim() ||
    current.description.trim() !== initial.description.trim()
  );
}

export interface UpdateStorePayload {
  name?: string;
  currency?: string;
  locale?: string;
  timezone?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  description?: string | null;
}

/**
 * Builds the PATCH payload, including only modified or populated fields without overwriting settings with defaults.
 */
export function settingsFormDataToUpdatePayload(
  current: StoreSettingsFormData,
  initial?: StoreSettingsFormData,
): UpdateStorePayload {
  const payload: UpdateStorePayload = {};

  if (!initial || current.name.trim() !== initial.name.trim()) {
    payload.name = current.name.trim();
  }

  if (
    !initial ||
    current.currency.trim().toUpperCase() !== initial.currency.trim().toUpperCase()
  ) {
    payload.currency = current.currency.trim().toUpperCase();
  }

  if (!initial || current.locale.trim() !== initial.locale.trim()) {
    payload.locale = current.locale.trim();
  }

  if (!initial || current.timezone.trim() !== initial.timezone.trim()) {
    payload.timezone = current.timezone.trim();
  }

  if (!initial || current.contactEmail.trim() !== initial.contactEmail.trim()) {
    payload.contactEmail = current.contactEmail.trim() || null;
  }

  if (!initial || current.contactPhone.trim() !== initial.contactPhone.trim()) {
    payload.contactPhone = current.contactPhone.trim() || null;
  }

  if (!initial || current.description.trim() !== initial.description.trim()) {
    payload.description = current.description.trim() || null;
  }

  return payload;
}

export type LifecycleActionType = "activate" | "suspend" | "reactivate" | "archive";

export interface LifecycleActionConfig {
  action: LifecycleActionType;
  label: string;
  description: string;
  variant: "primary" | "secondary" | "outline" | "danger";
  isDestructive: boolean;
  dialogTitle: string;
  dialogDescription: string;
  confirmLabel: string;
  disabled: boolean;
  disabledReason?: string;
}

/**
 * Checks if a user role can perform a specific store lifecycle action.
 * - Archiving requires "owner" role.
 * - Activation, suspension, and reactivation require at least "admin" role.
 */
export function canUserPerformLifecycleAction(
  action: LifecycleActionType,
  role?: string,
): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase();
  if (action === "archive") {
    return normalized === "owner";
  }
  return normalized === "owner" || normalized === "admin";
}

/**
 * Derives available lifecycle actions based on current store status and user permissions.
 */
export function getAvailableLifecycleActions(
  status: string,
  role?: string,
): LifecycleActionConfig[] {
  const canAdmin = canUserPerformLifecycleAction("activate", role);
  const canOwner = canUserPerformLifecycleAction("archive", role);

  switch (status) {
    case "DRAFT":
      return [
        {
          action: "activate",
          label: "Activate Store",
          description:
            "Make store active for commerce operations. Freezes base store currency permanently.",
          variant: "primary",
          isDestructive: false,
          dialogTitle: "Activate Merchant Store",
          dialogDescription:
            "Activating this store will enable commerce operations and catalog visibility. Note: the store currency cannot be modified after activation.",
          confirmLabel: "Activate Store",
          disabled: !canAdmin,
          disabledReason: !canAdmin ? "Requires Admin or Owner role" : undefined,
        },
        {
          action: "archive",
          label: "Archive Store",
          description:
            "Permanently archive this store. This action is terminal and cannot be undone.",
          variant: "danger",
          isDestructive: true,
          dialogTitle: "Permanently Archive Store",
          dialogDescription:
            "Are you sure you want to permanently archive this store? All storefront and merchant access will become read-only or closed. This action is irreversible.",
          confirmLabel: "Archive Permanently",
          disabled: !canOwner,
          disabledReason: !canOwner ? "Only the store Owner can archive a store" : undefined,
        },
      ];

    case "ACTIVE":
      return [
        {
          action: "suspend",
          label: "Suspend Store",
          description:
            "Temporarily suspend public storefront browsing and customer checkout.",
          variant: "outline",
          isDestructive: true,
          dialogTitle: "Suspend Store",
          dialogDescription:
            "Suspending this store will immediately prevent customers from accessing the storefront or completing checkouts. You can reactivate the store at any time.",
          confirmLabel: "Suspend Store",
          disabled: !canAdmin,
          disabledReason: !canAdmin ? "Requires Admin or Owner role" : undefined,
        },
        {
          action: "archive",
          label: "Archive Store",
          description:
            "Permanently archive this store. This action is terminal and cannot be undone.",
          variant: "danger",
          isDestructive: true,
          dialogTitle: "Permanently Archive Store",
          dialogDescription:
            "Are you sure you want to permanently archive this active store? All operations will cease. This action cannot be reversed.",
          confirmLabel: "Archive Permanently",
          disabled: !canOwner,
          disabledReason: !canOwner ? "Only the store Owner can archive a store" : undefined,
        },
      ];

    case "SUSPENDED":
      return [
        {
          action: "reactivate",
          label: "Reactivate Store",
          description:
            "Restore normal commerce operations and customer storefront access.",
          variant: "primary",
          isDestructive: false,
          dialogTitle: "Reactivate Store",
          dialogDescription:
            "Reactivating this store will restore full public storefront access and allow shoppers to browse and checkout.",
          confirmLabel: "Reactivate Store",
          disabled: !canAdmin,
          disabledReason: !canAdmin ? "Requires Admin or Owner role" : undefined,
        },
        {
          action: "archive",
          label: "Archive Store",
          description:
            "Permanently archive this store. This action is terminal and cannot be undone.",
          variant: "danger",
          isDestructive: true,
          dialogTitle: "Permanently Archive Store",
          dialogDescription:
            "Are you sure you want to permanently archive this suspended store? This action cannot be reversed.",
          confirmLabel: "Archive Permanently",
          disabled: !canOwner,
          disabledReason: !canOwner ? "Only the store Owner can archive a store" : undefined,
        },
      ];

    case "ARCHIVED":
    default:
      return [];
  }
}
