import {
  matchingZones,
  type ShippingDestination,
  type ZoneDefinition,
} from "./zone-matching.js";

export interface RateDefinition {
  id: string;
  zoneId: string;
  name: string;
  /** Minor units. */
  price: number;
  minWeightGrams: number;
  maxWeightGrams: number | null;
  /** Bands apply to the goods value after discount, in minor units. */
  minSubtotal: number;
  maxSubtotal: number | null;
  /** At or above this goods value the price becomes zero. */
  freeOverSubtotal: number | null;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  isActive: boolean;
}

/** One choice offered to the customer. Plain data, safe to store and render. */
export interface ShippingOption {
  rateId: string;
  name: string;
  price: number;
  isFree: boolean;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
}

export interface ShippingQuote {
  /** The zone that supplied the options, or null if nothing can ship it. */
  zoneId: string | null;
  zoneName: string | null;
  options: ShippingOption[];
  /** The option that applies: the customer's choice if still on offer, else the cheapest. */
  selected: ShippingOption | null;
  totalWeightGrams: number;
  goodsSubtotal: number;
}

export interface QuoteInput {
  zones: readonly ZoneDefinition[];
  rates: readonly RateDefinition[];
  destination: ShippingDestination;
  totalWeightGrams: number;
  /** Goods value after discount, in minor units. */
  goodsSubtotal: number;
  selectedRateId?: string | null;
}

/** Whether the parcel falls inside the rate's weight and value bands (inclusive). */
export function rateApplies(
  rate: RateDefinition,
  totalWeightGrams: number,
  goodsSubtotal: number,
): boolean {
  if (!rate.isActive) return false;
  if (totalWeightGrams < rate.minWeightGrams) return false;
  if (rate.maxWeightGrams !== null && totalWeightGrams > rate.maxWeightGrams) return false;
  if (goodsSubtotal < rate.minSubtotal) return false;
  if (rate.maxSubtotal !== null && goodsSubtotal > rate.maxSubtotal) return false;
  return true;
}

/** The price actually charged: zero once the free-shipping threshold is met. */
export function effectivePrice(rate: RateDefinition, goodsSubtotal: number): number {
  if (rate.freeOverSubtotal !== null && goodsSubtotal >= rate.freeOverSubtotal) {
    return 0;
  }
  return rate.price;
}

/**
 * Every applicable rate in the given set as an option, cheapest first. Ties
 * break on name then id so the order never depends on database row order.
 */
export function evaluateRates(
  rates: readonly RateDefinition[],
  totalWeightGrams: number,
  goodsSubtotal: number,
): ShippingOption[] {
  return rates
    .filter((rate) => rateApplies(rate, totalWeightGrams, goodsSubtotal))
    .map((rate): ShippingOption => {
      const price = effectivePrice(rate, goodsSubtotal);
      return {
        rateId: rate.id,
        name: rate.name,
        price,
        isFree: price === 0,
        estimatedDaysMin: rate.estimatedDaysMin,
        estimatedDaysMax: rate.estimatedDaysMax,
      };
    })
    .sort((a, b) => {
      if (a.price !== b.price) return a.price - b.price;
      const byName = a.name.localeCompare(b.name);
      return byName !== 0 ? byName : a.rateId.localeCompare(b.rateId);
    });
}

/**
 * The customer's choice if it is still on offer; otherwise the cheapest option.
 * A stale or foreign id therefore degrades to a sensible default rather than
 * charging a rate that no longer applies.
 */
export function chooseOption(
  options: readonly ShippingOption[],
  selectedRateId?: string | null,
): ShippingOption | null {
  if (options.length === 0) return null;
  if (selectedRateId) {
    const chosen = options.find((option) => option.rateId === selectedRateId);
    if (chosen) return chosen;
  }
  return options[0] ?? null;
}

/**
 * Quotes shipping for a destination and parcel.
 *
 * Zones are tried in priority order and the first that has at least one
 * applicable rate supplies the options. A narrow zone that matches the address
 * but cannot take this parcel (too heavy for its bands, say) therefore falls
 * through to a broader zone that can, rather than leaving the customer
 * unserviceable when the merchant does ship there.
 */
export function computeShippingQuote(input: QuoteInput): ShippingQuote {
  const goodsSubtotal = Math.max(0, input.goodsSubtotal);
  const ratesByZone = new Map<string, RateDefinition[]>();
  for (const rate of input.rates) {
    const bucket = ratesByZone.get(rate.zoneId);
    if (bucket) bucket.push(rate);
    else ratesByZone.set(rate.zoneId, [rate]);
  }

  for (const zone of matchingZones(input.zones, input.destination)) {
    const options = evaluateRates(
      ratesByZone.get(zone.id) ?? [],
      input.totalWeightGrams,
      goodsSubtotal,
    );
    if (options.length > 0) {
      return {
        zoneId: zone.id,
        zoneName: zone.name,
        options,
        selected: chooseOption(options, input.selectedRateId),
        totalWeightGrams: input.totalWeightGrams,
        goodsSubtotal,
      };
    }
  }

  return {
    zoneId: null,
    zoneName: null,
    options: [],
    selected: null,
    totalWeightGrams: input.totalWeightGrams,
    goodsSubtotal,
  };
}
