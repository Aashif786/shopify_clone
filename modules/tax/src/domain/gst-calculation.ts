import { allocateByWeight } from "./allocation.js";
import { InvalidGstRateError, InvalidPlaceOfSupplyError } from "./tax-errors.js";
import { isIndiaCountry, resolveGstStateCode } from "./gst-states.js";

export type SupplyType = "INTRA_STATE" | "INTER_STATE" | "EXPORT";

export const MAX_GST_RATE_BPS = 4000;

/** Stable key of the shipping line in a calculation, snapshot and invoice. */
export const SHIPPING_LINE_ID = "__shipping__";

/** SAC code for courier and delivery services, printed against the shipping line. */
export const SHIPPING_SAC_CODE = "9968";

export interface GstLineInput {
  /** Identifier echoed back so callers can map results to their own lines. */
  lineId: string;
  productId: string | null;
  hsnCode: string | null;
  /** GST rate in basis points (1800 = 18%). */
  rateBps: number;
  unitPrice: number;
  quantity: number;
}

export interface GstLineResult {
  lineId: string;
  productId: string | null;
  hsnCode: string | null;
  rateBps: number;
  quantity: number;
  unitPrice: number;
  /** unitPrice x quantity, before discount. */
  grossAmount: number;
  /** This line's share of the checkout discount. */
  discountAmount: number;
  /** grossAmount - discountAmount: the value tax is levied on. */
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxAmount: number;
}

export interface GstCalculation {
  supplyType: SupplyType;
  sellerStateCode: string;
  /** Null for an export, which has no Indian place of supply. */
  placeOfSupplyCode: string | null;
  subtotal: number;
  /** The discount actually applied, after clamping to the subtotal. */
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  lines: GstLineResult[];
}

export interface GstDestination {
  country: string | null | undefined;
  state: string | null | undefined;
}

export interface CalculateGstInput {
  sellerStateCode: string;
  destination: GstDestination;
  lines: readonly GstLineInput[];
  discountTotal: number;
  /**
   * Shipping charged on the order, in minor units. When above zero it becomes a
   * line of its own, taxed at the highest rate among the goods: shipping sold
   * with goods is a composite supply taxed as its principal supply, and for a
   * mixed basket the highest rate is the conservative reading. Shipping is not
   * discounted.
   */
  shippingAmount?: number;
}

/**
 * Integer division rounding half up. `n` and `d` are non-negative integers;
 * all the maths stays in exact integers so no floating-point drift can creep
 * into a legal tax figure.
 */
function roundedDivide(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

export function assertValidGstRateBps(rateBps: number): void {
  if (
    !Number.isInteger(rateBps) ||
    rateBps < 0 ||
    rateBps > MAX_GST_RATE_BPS
  ) {
    throw new InvalidGstRateError(
      `GST rate must be a whole number of basis points between 0 and ${MAX_GST_RATE_BPS}`,
    );
  }
}

/**
 * Classifies the supply from the seller's registration state and the buyer's
 * destination.
 *
 * - Outside India: an export, zero-rated here (no Indian place of supply).
 * - Same state as the seller: intra-state, taxed as CGST + SGST.
 * - Any other Indian state: inter-state, taxed as IGST.
 *
 * An Indian destination whose state cannot be resolved is rejected, because
 * guessing would charge the wrong tax head.
 */
export function determineSupply(
  sellerStateCode: string,
  destination: GstDestination,
): { supplyType: SupplyType; placeOfSupplyCode: string | null } {
  if (!isIndiaCountry(destination.country)) {
    return { supplyType: "EXPORT", placeOfSupplyCode: null };
  }

  const placeOfSupplyCode = resolveGstStateCode(destination.state);
  if (!placeOfSupplyCode) {
    throw new InvalidPlaceOfSupplyError(
      destination.state && destination.state.trim().length > 0
        ? `'${destination.state}' is not a recognised Indian state or union territory`
        : "Shipping state is required to calculate GST",
    );
  }

  return {
    supplyType: placeOfSupplyCode === sellerStateCode ? "INTRA_STATE" : "INTER_STATE",
    placeOfSupplyCode,
  };
}

/**
 * Computes GST for a checkout.
 *
 * Tax is exclusive: it is added on top of the listed price, so the platform's
 * `total = subtotal - discount + tax + shipping` invariant holds unchanged.
 *
 * Per line:
 *   taxable = unitPrice x quantity - allocated discount
 *   intra-state: CGST = SGST = round(taxable x rate / 2)
 *   inter-state: IGST = round(taxable x rate)
 *
 * CGST and SGST are always computed once and applied to both heads, so they
 * are equal by construction (the law requires equal halves) and an odd minor
 * unit can never make them differ.
 */
export function calculateGst(input: CalculateGstInput): GstCalculation {
  const { sellerStateCode, lines } = input;
  const { supplyType, placeOfSupplyCode } = determineSupply(
    sellerStateCode,
    input.destination,
  );

  const grossAmounts = lines.map((line) => {
    if (!Number.isInteger(line.unitPrice) || line.unitPrice < 0) {
      throw new Error(`Line '${line.lineId}' has an invalid unit price`);
    }
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error(`Line '${line.lineId}' has an invalid quantity`);
    }
    assertValidGstRateBps(line.rateBps);
    return line.unitPrice * line.quantity;
  });

  const subtotal = grossAmounts.reduce((sum, gross) => sum + gross, 0);

  if (!Number.isInteger(input.discountTotal) || input.discountTotal < 0) {
    throw new Error("Discount total must be a non-negative integer");
  }
  // A discount can never exceed what was bought; clamp rather than produce a
  // negative taxable value.
  const discountTotal = Math.min(input.discountTotal, subtotal);
  const discounts = allocateByWeight(discountTotal, grossAmounts);

  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let taxableTotal = 0;

  const results: GstLineResult[] = lines.map((line, index) => {
    const grossAmount = grossAmounts[index] ?? 0;
    const discountAmount = discounts[index] ?? 0;
    const taxableValue = grossAmount - discountAmount;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (supplyType === "INTRA_STATE") {
      const half = roundedDivide(taxableValue * line.rateBps, 20_000);
      cgst = half;
      sgst = half;
    } else if (supplyType === "INTER_STATE") {
      igst = roundedDivide(taxableValue * line.rateBps, 10_000);
    }

    cgstTotal += cgst;
    sgstTotal += sgst;
    igstTotal += igst;
    taxableTotal += taxableValue;

    return {
      lineId: line.lineId,
      productId: line.productId,
      hsnCode: line.hsnCode,
      rateBps: line.rateBps,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      grossAmount,
      discountAmount,
      taxableValue,
      cgst,
      sgst,
      igst,
      taxAmount: cgst + sgst + igst,
    };
  });

  const shippingAmount = input.shippingAmount ?? 0;
  if (!Number.isInteger(shippingAmount) || shippingAmount < 0) {
    throw new Error("Shipping amount must be a non-negative integer");
  }

  if (shippingAmount > 0) {
    const shippingRateBps = lines.reduce((highest, line) => Math.max(highest, line.rateBps), 0);
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    if (supplyType === "INTRA_STATE") {
      const half = roundedDivide(shippingAmount * shippingRateBps, 20_000);
      cgst = half;
      sgst = half;
    } else if (supplyType === "INTER_STATE") {
      igst = roundedDivide(shippingAmount * shippingRateBps, 10_000);
    }

    cgstTotal += cgst;
    sgstTotal += sgst;
    igstTotal += igst;
    taxableTotal += shippingAmount;

    results.push({
      lineId: SHIPPING_LINE_ID,
      productId: null,
      hsnCode: SHIPPING_SAC_CODE,
      rateBps: shippingRateBps,
      quantity: 1,
      unitPrice: shippingAmount,
      grossAmount: shippingAmount,
      discountAmount: 0,
      taxableValue: shippingAmount,
      cgst,
      sgst,
      igst,
      taxAmount: cgst + sgst + igst,
    });
  }

  return {
    supplyType,
    sellerStateCode,
    placeOfSupplyCode,
    subtotal,
    discountTotal,
    taxableTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    taxTotal: cgstTotal + sgstTotal + igstTotal,
    lines: results,
  };
}

/** GST rate as a display string, e.g. 1800 -> "18%", 250 -> "2.5%". */
export function formatGstRate(rateBps: number): string {
  const percent = rateBps / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/0+$/, "")}%`;
}
