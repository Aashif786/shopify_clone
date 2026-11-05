import { isValidGstStateCode } from "./gst-states.js";

const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHECKSUM_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Computes the GSTIN check character (the 15th character) from the first 14,
 * using the published modulo-36 algorithm.
 */
export function computeGstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const value = CHECKSUM_ALPHABET.indexOf(first14.charAt(i));
    if (value < 0) {
      throw new Error(`Invalid GSTIN character '${first14.charAt(i)}' at position ${i}`);
    }
    const factor = i % 2 === 0 ? 1 : 2;
    const product = value * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const checkIndex = (36 - (sum % 36)) % 36;
  return CHECKSUM_ALPHABET.charAt(checkIndex);
}

/** Normalizes user input: trims and upper-cases, nothing else. */
export function normalizeGstin(input: string): string {
  return input.trim().toUpperCase();
}

/**
 * Validates structure, state prefix and checksum. A GSTIN that merely matches
 * the pattern but fails the checksum is a typo, and printing it on a legal
 * invoice would make the invoice unusable for the buyer's input tax credit.
 */
export function isValidGstin(input: string | null | undefined): boolean {
  if (typeof input !== "string") return false;
  const gstin = normalizeGstin(input);
  if (!GSTIN_FORMAT.test(gstin)) return false;
  if (!isValidGstStateCode(gstin.slice(0, 2))) return false;
  return computeGstinCheckChar(gstin.slice(0, 14)) === gstin.charAt(14);
}

export function gstinStateCode(gstin: string): string {
  return normalizeGstin(gstin).slice(0, 2);
}
