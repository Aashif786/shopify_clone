import type { ShippingRateDTO, ShippingZoneDTO } from "@calcart/shipping";

/**
 * Pure helpers for the merchant shipping screen. The server is authoritative
 * for every rule; these give fast feedback and convert between what a merchant
 * types (rupees, kilograms-ish grams, comma lists) and what the API stores
 * (minor units, integer grams, arrays).
 *
 * Type-only imports from `@calcart/shipping`: importing a value would pull the
 * database driver into the browser bundle.
 */

/** "50" -> 5000, "49.5" -> 4950, "0.05" -> 5. Null for anything else. */
export function parseMoneyToMinor(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** 5000 -> "50", 4950 -> "49.50". */
export function minorToMoneyInput(minor: number): string {
  const whole = Math.floor(minor / 100);
  const fraction = minor % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, "0")}`;
}

/** Whole grams only: "1500" -> 1500. Null for fractions, negatives and text. */
export function parseGrams(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d{1,9}$/.test(trimmed)) return null;
  const grams = Number(trimmed);
  return grams <= 100_000_000 ? grams : null;
}

/** "1500" -> "1.5 kg", "250" -> "250 g". */
export function formatGrams(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${Number.isInteger(kg) ? kg : kg.toFixed(2).replace(/0+$/, "")} kg`;
  }
  return `${grams} g`;
}

/** Splits on commas and new lines, trims, drops blanks and duplicates. */
export function parseList(input: string): string[] {
  return [
    ...new Set(
      input
        .split(/[,\n]/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  ];
}

export interface ZoneFormData {
  name: string;
  countries: string;
  states: string;
  postalPrefixes: string;
  priority: string;
  isActive: boolean;
}

export const EMPTY_ZONE_FORM: ZoneFormData = {
  name: "",
  countries: "India",
  states: "",
  postalPrefixes: "",
  priority: "100",
  isActive: true,
};

export function zoneToForm(zone: ShippingZoneDTO): ZoneFormData {
  return {
    name: zone.name,
    countries: zone.countryCodes.join(", "),
    states: zone.stateNames.join(", "),
    postalPrefixes: zone.postalPrefixes.join(", "),
    priority: String(zone.priority),
    isActive: zone.isActive,
  };
}

export function validateZoneForm(form: ZoneFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = "Give the zone a name";
  else if (form.name.trim().length > 100) errors.name = "Name can be at most 100 characters";
  if (!/^\d{1,6}$/.test(form.priority.trim()) || Number(form.priority) > 100_000) {
    errors.priority = "Priority is a whole number from 0 to 100000";
  }
  if (parseList(form.countries).length > 50) errors.countries = "At most 50 countries";
  if (parseList(form.states).length > 50) errors.states = "At most 50 states";
  if (parseList(form.postalPrefixes).length > 50) errors.postalPrefixes = "At most 50 prefixes";
  return errors;
}

export function zoneFormToPayload(form: ZoneFormData) {
  return {
    name: form.name.trim(),
    countryCodes: parseList(form.countries),
    stateCodes: parseList(form.states),
    postalPrefixes: parseList(form.postalPrefixes),
    priority: Number(form.priority),
    isActive: form.isActive,
  };
}

export interface RateFormData {
  name: string;
  price: string;
  minWeight: string;
  maxWeight: string;
  minSubtotal: string;
  maxSubtotal: string;
  freeOver: string;
  daysMin: string;
  daysMax: string;
  isActive: boolean;
}

export const EMPTY_RATE_FORM: RateFormData = {
  name: "",
  price: "",
  minWeight: "",
  maxWeight: "",
  minSubtotal: "",
  maxSubtotal: "",
  freeOver: "",
  daysMin: "",
  daysMax: "",
  isActive: true,
};

export function rateToForm(rate: ShippingRateDTO): RateFormData {
  return {
    name: rate.name,
    price: minorToMoneyInput(rate.price),
    minWeight: rate.minWeightGrams > 0 ? String(rate.minWeightGrams) : "",
    maxWeight: rate.maxWeightGrams === null ? "" : String(rate.maxWeightGrams),
    minSubtotal: rate.minSubtotal > 0 ? minorToMoneyInput(rate.minSubtotal) : "",
    maxSubtotal: rate.maxSubtotal === null ? "" : minorToMoneyInput(rate.maxSubtotal),
    freeOver: rate.freeOverSubtotal === null ? "" : minorToMoneyInput(rate.freeOverSubtotal),
    daysMin: rate.estimatedDaysMin === null ? "" : String(rate.estimatedDaysMin),
    daysMax: rate.estimatedDaysMax === null ? "" : String(rate.estimatedDaysMax),
    isActive: rate.isActive,
  };
}

const isBlank = (value: string) => value.trim().length === 0;

export function validateRateForm(form: RateFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = "Give the rate a name, e.g. Standard";
  if (parseMoneyToMinor(form.price) === null) errors.price = "Enter a price like 50 or 49.50";

  const money: Array<[keyof RateFormData, string]> = [
    ["minSubtotal", "Minimum order value"],
    ["maxSubtotal", "Maximum order value"],
    ["freeOver", "Free-shipping threshold"],
  ];
  for (const [field, label] of money) {
    if (!isBlank(form[field] as string) && parseMoneyToMinor(form[field] as string) === null) {
      errors[field] = `${label} must be an amount like 500 or 499.50`;
    }
  }
  for (const [field, label] of [["minWeight", "Minimum weight"], ["maxWeight", "Maximum weight"]] as const) {
    if (!isBlank(form[field]) && parseGrams(form[field]) === null) {
      errors[field] = `${label} must be a whole number of grams`;
    }
  }
  for (const [field, label] of [["daysMin", "Minimum days"], ["daysMax", "Maximum days"]] as const) {
    if (!isBlank(form[field]) && !/^\d{1,3}$/.test(form[field].trim())) {
      errors[field] = `${label} must be a whole number`;
    }
  }

  const minW = isBlank(form.minWeight) ? 0 : parseGrams(form.minWeight);
  const maxW = isBlank(form.maxWeight) ? null : parseGrams(form.maxWeight);
  if (minW !== null && maxW !== null && maxW < minW && !errors.maxWeight) {
    errors.maxWeight = "Maximum weight cannot be below the minimum";
  }
  const minS = isBlank(form.minSubtotal) ? 0 : parseMoneyToMinor(form.minSubtotal);
  const maxS = isBlank(form.maxSubtotal) ? null : parseMoneyToMinor(form.maxSubtotal);
  if (minS !== null && maxS !== null && maxS < minS && !errors.maxSubtotal) {
    errors.maxSubtotal = "Maximum order value cannot be below the minimum";
  }
  if (
    !isBlank(form.daysMin) && !isBlank(form.daysMax) &&
    !errors.daysMin && !errors.daysMax &&
    Number(form.daysMax) < Number(form.daysMin)
  ) {
    errors.daysMax = "Maximum days cannot be below the minimum";
  }
  return errors;
}

export function rateFormToPayload(form: RateFormData) {
  const orNull = <T,>(value: string, parse: (v: string) => T | null): T | null =>
    isBlank(value) ? null : parse(value);
  return {
    name: form.name.trim(),
    price: parseMoneyToMinor(form.price) ?? 0,
    minWeightGrams: isBlank(form.minWeight) ? 0 : (parseGrams(form.minWeight) ?? 0),
    maxWeightGrams: orNull(form.maxWeight, parseGrams),
    minSubtotal: isBlank(form.minSubtotal) ? 0 : (parseMoneyToMinor(form.minSubtotal) ?? 0),
    maxSubtotal: orNull(form.maxSubtotal, parseMoneyToMinor),
    freeOverSubtotal: orNull(form.freeOver, parseMoneyToMinor),
    estimatedDaysMin: orNull(form.daysMin, (v) => Number(v)),
    estimatedDaysMax: orNull(form.daysMax, (v) => Number(v)),
    isActive: form.isActive,
  };
}

/** Human summary of a zone's reach, e.g. "India · Maharashtra, Karnataka · PIN 560, 400". */
export function describeZone(zone: ShippingZoneDTO): string {
  const parts: string[] = [];
  parts.push(zone.countryCodes.length > 0 ? zone.countryCodes.join(", ") : "Anywhere");
  if (zone.stateNames.length > 0) parts.push(zone.stateNames.join(", "));
  if (zone.postalPrefixes.length > 0) parts.push(`PIN ${zone.postalPrefixes.join(", ")}`);
  return parts.join(" · ");
}

/** "Up to 2 kg", "From 500 g", "500 g to 2 kg", or "Any weight". */
export function describeWeightBand(rate: ShippingRateDTO): string {
  const { minWeightGrams: min, maxWeightGrams: max } = rate;
  if (min > 0 && max !== null) return `${formatGrams(min)} to ${formatGrams(max)}`;
  if (max !== null) return `Up to ${formatGrams(max)}`;
  if (min > 0) return `From ${formatGrams(min)}`;
  return "Any weight";
}
