import { isIndiaCountry, resolveGstStateCode } from "@calcart/tax";

export interface ShippingDestination {
  country: string | null | undefined;
  state: string | null | undefined;
  postalCode: string | null | undefined;
}

export interface ZoneDefinition {
  id: string;
  name: string;
  /** Normalised country codes; empty means any country. */
  countryCodes: readonly string[];
  /** GST state codes (India only); empty means any state. */
  stateCodes: readonly string[];
  /** PIN / postal prefixes; empty means any postal code. */
  postalPrefixes: readonly string[];
  /** Lower matches first. */
  priority: number;
  isActive: boolean;
}

/**
 * Canonical form of a country for matching. Every spelling of India collapses
 * to "IN"; anything else is compared as trimmed upper-case text, so a merchant
 * and a customer who both type "united states" agree without a country table.
 */
export function normalizeCountry(country: string | null | undefined): string {
  if (isIndiaCountry(country)) return "IN";
  return (country ?? "").trim().toUpperCase();
}

/** Upper-cases and removes spaces and hyphens, so "560 001" matches "560001". */
export function normalizePostalCode(postalCode: string | null | undefined): string {
  return (postalCode ?? "").replace(/[\s-]+/g, "").toUpperCase();
}

/** True when `zone` serves `destination`. A blank zone field matches anything. */
export function zoneMatches(zone: ZoneDefinition, destination: ShippingDestination): boolean {
  if (!zone.isActive) return false;

  const country = normalizeCountry(destination.country);

  if (zone.countryCodes.length > 0 && !zone.countryCodes.includes(country)) {
    return false;
  }

  if (zone.stateCodes.length > 0) {
    // State codes are GST codes, so they can only describe an Indian address.
    if (country !== "IN") return false;
    const stateCode = resolveGstStateCode(destination.state);
    if (!stateCode || !zone.stateCodes.includes(stateCode)) return false;
  }

  if (zone.postalPrefixes.length > 0) {
    const postal = normalizePostalCode(destination.postalCode);
    if (!zone.postalPrefixes.some((prefix) => postal.startsWith(prefix))) {
      return false;
    }
  }

  return true;
}

/**
 * Every active zone that serves the destination, narrowest intent first: by
 * priority (lower wins), then by name, then id, so the order is deterministic.
 */
export function matchingZones(
  zones: readonly ZoneDefinition[],
  destination: ShippingDestination,
): ZoneDefinition[] {
  return zones
    .filter((zone) => zoneMatches(zone, destination))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const byName = a.name.localeCompare(b.name);
      return byName !== 0 ? byName : a.id.localeCompare(b.id);
    });
}
