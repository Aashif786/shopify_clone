import type { Database } from "@calcart/db";
import type { CheckoutDTO } from "@calcart/checkout";
import { ShippingService } from "@calcart/shipping";
import { TaxService } from "@calcart/tax";
import {
  enrichCheckout,
  type StorefrontCheckoutEnrichedDTO,
  type StorefrontShippingDTO,
  type StorefrontTaxBreakdownDTO,
} from "./storefront-checkout-helpers";

/**
 * Server-only on purpose. `storefront-checkout-helpers` is imported by client
 * components for its validators and types; anything that pulls in `TaxService`
 * (and through it the `pg` driver) must live here, or it ends up in the browser
 * bundle and the production build fails on `fs`, `net` and `dns`.
 */
const taxService = new TaxService();
const shippingService = new ShippingService();

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

async function loadShipping(
  db: Database,
  storeId: string,
  checkoutId: string,
): Promise<{ shippingEnabled: boolean; shipping: StorefrontShippingDTO | null }> {
  const settings = await shippingService.getSettings(db, storeId);
  if (!settings.isEnabled) {
    return { shippingEnabled: false, shipping: null };
  }

  const quote = await shippingService.getCheckoutQuote(db, storeId, checkoutId);
  if (!quote) {
    return { shippingEnabled: true, shipping: null };
  }

  return {
    shippingEnabled: true,
    shipping: {
      isServiceable: quote.selectedRateId !== null,
      selectedRateId: quote.selectedRateId,
      selectedRateName: quote.selectedRateName,
      price: quote.shippingPrice,
      options: quote.options,
    },
  };
}

/**
 * `enrichCheckout` plus the GST breakdown and the shipping quote. Kept separate
 * because `enrichCheckout` has a pinned contract (no database call for an empty
 * basket). Every storefront checkout response uses this one, so the customer
 * always sees exactly what the payment will charge.
 */
export async function enrichStorefrontCheckout(
  db: Database,
  storeId: string,
  checkout: CheckoutDTO,
): Promise<StorefrontCheckoutEnrichedDTO> {
  const enriched = await enrichCheckout(db, storeId, checkout);
  const [{ taxEnabled, tax }, { shippingEnabled, shipping }] = await Promise.all([
    loadTaxBreakdown(db, storeId, checkout.id),
    loadShipping(db, storeId, checkout.id),
  ]);
  return { ...enriched, taxEnabled, tax, shippingEnabled, shipping };
}
