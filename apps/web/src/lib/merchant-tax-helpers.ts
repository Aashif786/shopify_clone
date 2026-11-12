/**
 * Pure helpers for the merchant tax screen. The server is always authoritative
 * (GSTIN checksum, state match, completeness); these only give the merchant
 * fast feedback and convert between the percentage they type and the integer
 * basis points the API stores.
 */

export const MAX_GST_RATE_PERCENT = 40;

/** 1800 -> "18", 250 -> "2.5", 25 -> "0.25", 0 -> "0". */
export function bpsToPercentInput(bps: number): string {
  const percent = bps / 100;
  return Number.isInteger(percent)
    ? String(percent)
    : percent.toFixed(2).replace(/0+$/, "");
}

/**
 * Parses what the merchant typed ("18", "2.5", "0.25") into basis points.
 * Returns null for anything that is not a plain percentage with at most two
 * decimals between 0 and 40, so a typo is rejected instead of being rounded
 * into a different tax rate.
 */
export function percentInputToBps(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(trimmed)) return null;
  const percent = Number(trimmed);
  if (!Number.isFinite(percent) || percent < 0 || percent > MAX_GST_RATE_PERCENT) {
    return null;
  }
  // Round to absorb binary floating point, e.g. 0.29 * 100 = 28.999999999999996.
  return Math.round(percent * 100);
}

/** 1800 -> "18%", 250 -> "2.5%". */
export function formatRatePercent(bps: number): string {
  return `${bpsToPercentInput(bps)}%`;
}

/** Upper-cases and strips whitespace as the merchant types a GSTIN. */
export function normalizeGstinInput(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase().slice(0, 15);
}

const GSTIN_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const HSN_SHAPE = /^[0-9]{4,8}$/;
const PIN_SHAPE = /^[1-9][0-9]{5}$/;

export interface TaxSettingsFormData {
  isEnabled: boolean;
  pricesIncludeTax: boolean;
  legalName: string;
  gstin: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  defaultRatePercent: string;
}

/**
 * Field-level checks mirroring the server's rules that can be known without
 * the state table or the GSTIN checksum. Required fields are only enforced
 * when tax is being switched on, matching the server.
 */
export function validateTaxSettingsForm(
  data: TaxSettingsFormData,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (data.isEnabled) {
    if (!data.legalName.trim()) errors.legalName = "Legal name is required to charge GST";
    if (!data.gstin) errors.gstin = "GSTIN is required to charge GST";
    if (!data.addressLine1.trim()) errors.addressLine1 = "Address is required on a tax invoice";
    if (!data.city.trim()) errors.city = "City is required on a tax invoice";
    if (!data.postalCode.trim()) errors.postalCode = "PIN code is required on a tax invoice";
  }

  if (data.gstin && !GSTIN_SHAPE.test(data.gstin)) {
    errors.gstin = "A GSTIN is 15 characters, for example 27AAPFU0939F1ZV";
  }
  if (data.postalCode.trim() && !PIN_SHAPE.test(data.postalCode.trim())) {
    errors.postalCode = "PIN code must be 6 digits";
  }
  if (percentInputToBps(data.defaultRatePercent) === null) {
    errors.defaultRatePercent = `Enter a rate from 0 to ${MAX_GST_RATE_PERCENT}, up to two decimals`;
  }

  return errors;
}

export interface ProductTaxDraft {
  hsnCode: string;
  ratePercent: string;
}

export function validateProductTaxDraft(draft: ProductTaxDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!HSN_SHAPE.test(draft.hsnCode.trim())) {
    errors.hsnCode = "HSN/SAC must be 4 to 8 digits";
  }
  if (percentInputToBps(draft.ratePercent) === null) {
    errors.ratePercent = `Rate must be 0 to ${MAX_GST_RATE_PERCENT}`;
  }
  return errors;
}
