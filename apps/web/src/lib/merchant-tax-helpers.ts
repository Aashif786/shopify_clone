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

export interface GstSplitBreakdown {
  totalRatePercent: number;
  cgstRatePercent: number;
  sgstRatePercent: number;
  igstRatePercent: number;
  formattedTotal: string;
  formattedCgst: string;
  formattedSgst: string;
  formattedIgst: string;
  summaryLabel: string;
}

/**
 * Standard Indian GST rate presets for quick selection:
 * 0% (Exempt), 3% (Precious metals/jewellery), 5% (Essentials),
 * 12% (Standard I), 18% (Standard II), 28% (Luxury/Demerit).
 */
export const STANDARD_GST_PRESETS = [
  { label: "0%", ratePercent: "0", bps: 0, description: "Nil / Exempt" },
  { label: "3%", ratePercent: "3", bps: 300, description: "1.5% CGST + 1.5% SGST" },
  { label: "5%", ratePercent: "5", bps: 500, description: "2.5% CGST + 2.5% SGST" },
  { label: "12%", ratePercent: "12", bps: 1200, description: "6% CGST + 6% SGST" },
  { label: "18%", ratePercent: "18", bps: 1800, description: "9% CGST + 9% SGST" },
  { label: "28%", ratePercent: "28", bps: 2800, description: "14% CGST + 14% SGST" },
] as const;

/**
 * Computes CGST and SGST equal split and IGST rate details from basis points or a percent input.
 */
export function getGstSplitBreakdown(bpsOrPercentInput: number | string): GstSplitBreakdown | null {
  let bps: number | null = null;
  if (typeof bpsOrPercentInput === "number") {
    bps = bpsOrPercentInput;
  } else {
    bps = percentInputToBps(bpsOrPercentInput);
  }
  if (bps === null || bps < 0 || bps > MAX_GST_RATE_PERCENT * 100) return null;

  const totalPercent = bps / 100;
  const halfPercent = totalPercent / 2;

  const fmt = (p: number) =>
    Number.isInteger(p) ? `${p}%` : `${p.toFixed(2).replace(/0+$/, "")}%`;

  const formattedTotal = fmt(totalPercent);
  const formattedCgst = fmt(halfPercent);
  const formattedSgst = fmt(halfPercent);
  const formattedIgst = formattedTotal;

  return {
    totalRatePercent: totalPercent,
    cgstRatePercent: halfPercent,
    sgstRatePercent: halfPercent,
    igstRatePercent: totalPercent,
    formattedTotal,
    formattedCgst,
    formattedSgst,
    formattedIgst,
    summaryLabel:
      bps > 0
        ? `${formattedCgst} CGST + ${formattedSgst} SGST (${formattedTotal} IGST)`
        : "0% (Exempt / Nil Rated)",
  };
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
