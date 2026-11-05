import type { Database } from "@calcart/db";
import type { CheckoutDTO } from "@calcart/checkout";
import { TaxService } from "@calcart/tax";
import {
  enrichCheckout,
  type StorefrontCheckoutWithTaxDTO,
  type StorefrontTaxBreakdownDTO,
} from "./storefront-checkout-helpers";

/**
 * Server-only on purpose. `storefront-checkout-helpers` is imported by client
 * components for its validators and types; anything that pulls in `TaxService`
 * (and through it the `pg` driver) must live here, or it ends up in the browser
 * bundle and the production build fails on `fs`, `net` and `dns`.
 */
const taxService = new TaxService();

/**
 * Reads the frozen GST calculation the checkout total was built from. Never
 * recalculates: what the customer sees is exactly what they will be charged.
 */
async function loadTaxBreakdown(
  db: Database,
  storeId: string,
  checkoutId: string,
): Promise<{ taxEnabled: boolean; tax: StorefrontTaxBreakdownDTO | null }> {
  const settings = await taxService.getSettings(db, storeId);
  if (!settings.isEnabled) {
    return { taxEnabled: false, tax: null };
  }

  const snapshot = await taxService.getCheckoutTaxSnapshot(db, storeId, checkoutId);
  if (!snapshot) {
    return { taxEnabled: true, tax: null };
  }

  return {
    taxEnabled: true,
    tax: {
      supplyType: snapshot.supplyType,
      placeOfSupplyName: snapshot.placeOfSupplyName,
      taxableTotal: snapshot.taxableTotal,
      cgstTotal: snapshot.cgstTotal,
      sgstTotal: snapshot.sgstTotal,
      igstTotal: snapshot.igstTotal,
      taxTotal: snapshot.taxTotal,
      lines: snapshot.lines.map((line) => ({
        lineId: line.lineId,
        description: line.description,
        hsnCode: line.hsnCode,
        rateBps: line.rateBps,
        taxableValue: line.taxableValue,
        cgst: line.cgst,
        sgst: line.sgst,
        igst: line.igst,
        taxAmount: line.taxAmount,
      })),
    },
  };
}

/**
 * `enrichCheckout` plus the GST breakdown. Kept separate because
 * `enrichCheckout` has a pinned contract (no database call for an empty basket).
 * Every storefront checkout response uses this one.
 */
export async function enrichCheckoutWithTax(
  db: Database,
  storeId: string,
  checkout: CheckoutDTO,
): Promise<StorefrontCheckoutWithTaxDTO> {
  const enriched = await enrichCheckout(db, storeId, checkout);
  const { taxEnabled, tax } = await loadTaxBreakdown(db, storeId, checkout.id);
  return { ...enriched, taxEnabled, tax };
}
