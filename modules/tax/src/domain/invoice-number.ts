import { InvoiceNumberExhaustedError } from "./tax-errors.js";

/** Rule 46 of the CGST Rules caps an invoice number at 16 characters. */
export const MAX_INVOICE_NUMBER_LENGTH = 16;

export const INVOICE_PREFIX = "INV";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Indian financial-year code for `date`, as the two-digit start and end years
 * ("2627" for April 2026 to March 2027).
 *
 * The boundary is evaluated in IST, because an invoice raised at 00:30 IST on
 * 1 April belongs to the new year even though it is still 31 March in UTC.
 */
export function financialYearCode(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const startYear = ist.getUTCMonth() >= 3 ? year : year - 1;
  const start = String(startYear % 100).padStart(2, "0");
  const end = String((startYear + 1) % 100).padStart(2, "0");
  return `${start}${end}`;
}

/** "2627" -> "2026-27", for display on the invoice. */
export function financialYearLabel(code: string): string {
  const start = Number(code.slice(0, 2));
  const end = code.slice(2, 4);
  // Two-digit years are interpreted in the 2000s, which holds for any
  // invoice issued by this platform.
  return `${2000 + start}-${end}`;
}

/**
 * Formats a sequence number as `INV/<fy>/<6-digit serial>`, e.g.
 * `INV/2627/000001`. A serial past 999,999 widens to seven digits, which is
 * exactly 16 characters; anything longer is refused rather than truncated.
 */
export function formatInvoiceNumber(financialYear: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("Invoice sequence must be a positive integer");
  }
  const number = `${INVOICE_PREFIX}/${financialYear}/${String(sequence).padStart(6, "0")}`;
  if (number.length > MAX_INVOICE_NUMBER_LENGTH) {
    throw new InvoiceNumberExhaustedError();
  }
  return number;
}
