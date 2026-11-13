import type { ShippingOption } from "../domain/rate-evaluation.js";

export interface ShippingSettingsDTO {
  storeId: string;
  isEnabled: boolean;
  /** Weight assumed for a product with no weight of its own. */
  defaultWeightGrams: number;
  /** True when the store has never saved shipping settings. */
  isDefault: boolean;
  updatedAt: string | null;
}

export interface UpdateShippingSettingsInput {
  isEnabled?: boolean;
  defaultWeightGrams?: number;
}

export interface ShippingRateDTO {
  id: string;
  storeId: string;
  zoneId: string;
  name: string;
  price: number;
  minWeightGrams: number;
  maxWeightGrams: number | null;
  minSubtotal: number;
  maxSubtotal: number | null;
  freeOverSubtotal: number | null;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  isActive: boolean;
}

export interface ShippingZoneDTO {
  id: string;
  storeId: string;
  name: string;
  countryCodes: string[];
  stateCodes: string[];
  /** Display names for `stateCodes`, in the same order. */
  stateNames: string[];
  postalPrefixes: string[];
  priority: number;
  isActive: boolean;
  rates: ShippingRateDTO[];
}

export interface UpsertShippingZoneInput {
  name: string;
  countryCodes?: string[];
  /** States by name, abbreviation or GST code; stored as canonical codes. */
  stateCodes?: string[];
  postalPrefixes?: string[];
  priority?: number;
  isActive?: boolean;
}

export interface UpsertShippingRateInput {
  name: string;
  price: number;
  minWeightGrams?: number;
  maxWeightGrams?: number | null;
  minSubtotal?: number;
  maxSubtotal?: number | null;
  freeOverSubtotal?: number | null;
  estimatedDaysMin?: number | null;
  estimatedDaysMax?: number | null;
  isActive?: boolean;
}

export interface ProductShippingProfileDTO {
  storeId: string;
  productId: string;
  weightGrams: number;
  updatedAt: string;
}

export interface QuoteCheckoutLine {
  lineId: string;
  productId: string | null;
  quantity: number;
}

export interface QuoteCheckoutInput {
  storeId: string;
  checkoutId: string;
  lines: QuoteCheckoutLine[];
  /** Goods value after discount, in minor units. */
  goodsSubtotal: number;
  /** Null until the customer has entered a shipping address. */
  destination: {
    country: string | null | undefined;
    state: string | null | undefined;
    postalCode: string | null | undefined;
  } | null;
  /**
   * An explicit customer choice. If it is not on offer the call fails; this is
   * how a stale or forged id is refused instead of silently re-priced.
   * When omitted, the previously stored choice is kept if it is still on offer.
   */
  requestedRateId?: string | null;
}

export interface CheckoutShippingQuoteDTO {
  checkoutId: string;
  zoneId: string | null;
  zoneName: string | null;
  selectedRateId: string | null;
  selectedRateName: string | null;
  shippingPrice: number;
  totalWeightGrams: number;
  goodsSubtotal: number;
  options: ShippingOption[];
  calculatedAt: string;
}

export interface CheckoutShippingResult {
  /** False when the store has shipping switched off; checkout is left alone. */
  isEnabled: boolean;
  /** True when shipping is on but there is no address yet to quote against. */
  isAwaitingDestination: boolean;
  /** False when an address exists but no zone/rate can ship the order there. */
  isServiceable: boolean;
  shippingTotal: number;
  quote: CheckoutShippingQuoteDTO | null;
}
