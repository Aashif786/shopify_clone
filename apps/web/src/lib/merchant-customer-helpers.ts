import type {
  CustomerAddressDTO,
  CustomerDTO,
  CustomerStatus,
  CustomerWithAddressesDTO,
} from "@calcart/customers";

export interface CustomerFilterState {
  search: string;
  status: "ALL" | CustomerStatus;
}

export const INITIAL_CUSTOMER_FILTERS: CustomerFilterState = {
  search: "",
  status: "ALL",
};

export interface CustomerFormData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export const INITIAL_CUSTOMER_FORM_DATA: CustomerFormData = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
};

export interface CustomerAddressFormData {
  firstName: string;
  lastName: string;
  company: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  label: string;
  isDefault: boolean;
}

export const INITIAL_ADDRESS_FORM_DATA: CustomerAddressFormData = {
  firstName: "",
  lastName: "",
  company: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
  phone: "",
  label: "Home",
  isDefault: false,
};

export interface CustomerMetrics {
  totalCustomers: number;
  activeCustomers: number;
  disabledCustomers: number;
  totalOrders: number;
  totalSpend: number;
  currency: string;
}

/**
 * Format customer's full name, falling back to email or 'Unnamed Customer'.
 */
export function formatCustomerName(customer: {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}): string {
  const parts = [customer.firstName?.trim(), customer.lastName?.trim()].filter(
    Boolean,
  );
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return customer.email || "Unnamed Customer";
}

/**
 * Format ISO date string into friendly localized display.
 */
export function formatCustomerDate(dateString?: string | null): string {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return dateString;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate customer profile fields.
 */
export function validateCustomerFormData(
  data: CustomerFormData,
): Record<string, string> {
  const errors: Record<string, string> = {};

  const email = data.email.trim();
  if (!email) {
    errors.email = "Email address is required.";
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = "Please enter a valid email address.";
  } else if (email.length > 255) {
    errors.email = "Email cannot exceed 255 characters.";
  }

  if (data.firstName && data.firstName.trim().length > 100) {
    errors.firstName = "First name cannot exceed 100 characters.";
  }

  if (data.lastName && data.lastName.trim().length > 100) {
    errors.lastName = "Last name cannot exceed 100 characters.";
  }

  if (data.phone && data.phone.trim().length > 50) {
    errors.phone = "Phone number cannot exceed 50 characters.";
  }

  return errors;
}

/**
 * Validate customer address fields.
 */
export function validateCustomerAddressFormData(
  data: CustomerAddressFormData,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.addressLine1 || !data.addressLine1.trim()) {
    errors.addressLine1 = "Address line 1 is required.";
  } else if (data.addressLine1.trim().length > 255) {
    errors.addressLine1 = "Address line 1 cannot exceed 255 characters.";
  }

  if (data.addressLine2 && data.addressLine2.trim().length > 255) {
    errors.addressLine2 = "Address line 2 cannot exceed 255 characters.";
  }

  if (!data.city || !data.city.trim()) {
    errors.city = "City is required.";
  } else if (data.city.trim().length > 100) {
    errors.city = "City cannot exceed 100 characters.";
  }

  if (data.state && data.state.trim().length > 100) {
    errors.state = "State cannot exceed 100 characters.";
  }

  if (!data.postalCode || !data.postalCode.trim()) {
    errors.postalCode = "Postal code is required.";
  } else if (data.postalCode.trim().length > 32) {
    errors.postalCode = "Postal code cannot exceed 32 characters.";
  }

  if (!data.country || !data.country.trim()) {
    errors.country = "Country is required.";
  } else if (data.country.trim().length > 64) {
    errors.country = "Country cannot exceed 64 characters.";
  }

  if (data.firstName && data.firstName.trim().length > 100) {
    errors.firstName = "First name cannot exceed 100 characters.";
  }

  if (data.lastName && data.lastName.trim().length > 100) {
    errors.lastName = "Last name cannot exceed 100 characters.";
  }

  if (data.company && data.company.trim().length > 100) {
    errors.company = "Company cannot exceed 100 characters.";
  }

  if (data.phone && data.phone.trim().length > 50) {
    errors.phone = "Phone cannot exceed 50 characters.";
  }

  if (data.label && data.label.trim().length > 100) {
    errors.label = "Label cannot exceed 100 characters.";
  }

  return errors;
}

/**
 * Return badge variant and label for customer status.
 */
export function getCustomerStatusBadgeConfig(status: CustomerStatus): {
  variant: "success" | "neutral";
  label: string;
} {
  if (status === "ACTIVE") {
    return { variant: "success", label: "Active" };
  }
  return { variant: "neutral", label: "Disabled" };
}

/**
 * Format customer monetary amount in minor units (cents) to localized currency string.
 */
export function formatCustomerSpend(
  cents: number | null | undefined,
  currency: string = "USD",
): string {
  if (cents === null || cents === undefined || isNaN(cents)) {
    return "—";
  }
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

/**
 * Calculate customer directory summary metrics.
 */
export function calculateCustomerMetrics(
  customers: CustomerDTO[],
): CustomerMetrics {
  let active = 0;
  let disabled = 0;
  let totalOrders = 0;
  let totalSpend = 0;
  const currency = customers.find((c) => c.currency)?.currency || "USD";

  for (const c of customers) {
    if (c.status === "ACTIVE") {
      active++;
    } else {
      disabled++;
    }
    totalOrders += c.ordersCount ?? 0;
    totalSpend += c.totalSpend ?? 0;
  }

  return {
    totalCustomers: customers.length,
    activeCustomers: active,
    disabledCustomers: disabled,
    totalOrders,
    totalSpend,
    currency,
  };
}

export type { CustomerAddressDTO, CustomerDTO, CustomerWithAddressesDTO };
