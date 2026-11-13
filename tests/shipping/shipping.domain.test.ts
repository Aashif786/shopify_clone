import { describe, expect, it } from "vitest";
import {
  chooseOption,
  computeShippingQuote,
  effectivePrice,
  evaluateRates,
  matchingZones,
  normalizeCountry,
  normalizePostalCode,
  rateApplies,
  zoneMatches,
  type RateDefinition,
  type ZoneDefinition,
} from "@calcart/shipping";

function zone(overrides: Partial<ZoneDefinition> = {}): ZoneDefinition {
  return {
    id: "z1",
    name: "India",
    countryCodes: ["IN"],
    stateCodes: [],
    postalPrefixes: [],
    priority: 100,
    isActive: true,
    ...overrides,
  };
}

function rate(overrides: Partial<RateDefinition> = {}): RateDefinition {
  return {
    id: "r1",
    zoneId: "z1",
    name: "Standard",
    price: 5_000,
    minWeightGrams: 0,
    maxWeightGrams: null,
    minSubtotal: 0,
    maxSubtotal: null,
    freeOverSubtotal: null,
    estimatedDaysMin: null,
    estimatedDaysMax: null,
    isActive: true,
    ...overrides,
  };
}

const MUMBAI = { country: "India", state: "Maharashtra", postalCode: "400001" };
const BENGALURU = { country: "IN", state: "Karnataka", postalCode: "560 001" };
const NEW_YORK = { country: "United States", state: "New York", postalCode: "10001" };

describe("Shipping domain: normalisation", () => {
  it("collapses every spelling of India and compares other countries as text", () => {
    for (const c of ["India", "IN", "in", " ind ", "Bharat"]) {
      expect(normalizeCountry(c)).toBe("IN");
    }
    expect(normalizeCountry("united states")).toBe("UNITED STATES");
    expect(normalizeCountry(null)).toBe("");
  });

  it("ignores spaces and hyphens in postal codes", () => {
    expect(normalizePostalCode("560 001")).toBe("560001");
    expect(normalizePostalCode("sw1a-1aa")).toBe("SW1A1AA");
    expect(normalizePostalCode(undefined)).toBe("");
  });
});

describe("Shipping domain: zone matching", () => {
  it("treats empty zone fields as 'any'", () => {
    const anywhere = zone({ countryCodes: [] });
    expect(zoneMatches(anywhere, MUMBAI)).toBe(true);
    expect(zoneMatches(anywhere, NEW_YORK)).toBe(true);
  });

  it("matches by country, including every spelling of India", () => {
    const india = zone();
    expect(zoneMatches(india, MUMBAI)).toBe(true);
    expect(zoneMatches(india, BENGALURU)).toBe(true);
    expect(zoneMatches(india, NEW_YORK)).toBe(false);
    expect(zoneMatches(zone({ countryCodes: ["UNITED STATES"] }), NEW_YORK)).toBe(true);
  });

  it("matches states by GST code, resolving names, aliases and abbreviations", () => {
    const maharashtra = zone({ stateCodes: ["27"] });
    expect(zoneMatches(maharashtra, MUMBAI)).toBe(true);
    expect(zoneMatches(maharashtra, { ...MUMBAI, state: "MH" })).toBe(true);
    expect(zoneMatches(maharashtra, { ...MUMBAI, state: "maharashtra" })).toBe(true);
    expect(zoneMatches(maharashtra, BENGALURU)).toBe(false);
    // An unresolvable state can never match a state-restricted zone.
    expect(zoneMatches(maharashtra, { ...MUMBAI, state: "Atlantis" })).toBe(false);
    expect(zoneMatches(maharashtra, { ...MUMBAI, state: null })).toBe(false);
  });

  it("never matches a state-restricted zone for a non-Indian address", () => {
    const restricted = zone({ countryCodes: [], stateCodes: ["27"] });
    expect(zoneMatches(restricted, NEW_YORK)).toBe(false);
  });

  it("matches postal prefixes after normalising the code", () => {
    const south = zone({ postalPrefixes: ["560", "5600"] });
    expect(zoneMatches(south, BENGALURU)).toBe(true); // "560 001"
    expect(zoneMatches(south, MUMBAI)).toBe(false);
    expect(zoneMatches(south, { ...BENGALURU, postalCode: "" })).toBe(false);
  });

  it("requires every restriction to hold at once", () => {
    const narrow = zone({ stateCodes: ["29"], postalPrefixes: ["560"] });
    expect(zoneMatches(narrow, BENGALURU)).toBe(true);
    expect(zoneMatches(narrow, { ...BENGALURU, postalCode: "575001" })).toBe(false);
  });

  it("never matches an inactive zone", () => {
    expect(zoneMatches(zone({ isActive: false }), MUMBAI)).toBe(false);
  });

  it("orders matches by priority, then name, then id, deterministically", () => {
    const zones = [
      zone({ id: "c", name: "Zeta", priority: 10 }),
      zone({ id: "b", name: "Alpha", priority: 10 }),
      zone({ id: "a", name: "Alpha", priority: 10 }),
      zone({ id: "d", name: "First", priority: 1 }),
      zone({ id: "e", name: "Other", countryCodes: ["FR"], priority: 0 }),
    ];
    expect(matchingZones(zones, MUMBAI).map((z) => z.id)).toEqual(["d", "a", "b", "c"]);
  });
});

describe("Shipping domain: rate bands", () => {
  it("applies bands inclusively at both ends", () => {
    const r = rate({ minWeightGrams: 500, maxWeightGrams: 1_000, minSubtotal: 100, maxSubtotal: 900 });
    expect(rateApplies(r, 500, 100)).toBe(true);
    expect(rateApplies(r, 1_000, 900)).toBe(true);
    expect(rateApplies(r, 499, 500)).toBe(false);
    expect(rateApplies(r, 1_001, 500)).toBe(false);
    expect(rateApplies(r, 700, 99)).toBe(false);
    expect(rateApplies(r, 700, 901)).toBe(false);
  });

  it("treats a null maximum as unbounded", () => {
    expect(rateApplies(rate({ minWeightGrams: 1_000 }), 5_000_000, 999_999_999)).toBe(true);
  });

  it("never applies an inactive rate", () => {
    expect(rateApplies(rate({ isActive: false }), 100, 100)).toBe(false);
  });

  it("drops the price to zero at or above the free-shipping threshold", () => {
    const r = rate({ price: 5_000, freeOverSubtotal: 50_000 });
    expect(effectivePrice(r, 49_999)).toBe(5_000);
    expect(effectivePrice(r, 50_000)).toBe(0);
    expect(effectivePrice(r, 90_000)).toBe(0);
    expect(effectivePrice(rate({ price: 5_000 }), 9_999_999)).toBe(5_000);
  });

  it("lists applicable options cheapest first, flagging free ones", () => {
    const options = evaluateRates(
      [
        rate({ id: "x", name: "Express", price: 15_000 }),
        rate({ id: "y", name: "Standard", price: 5_000, freeOverSubtotal: 1_000 }),
        rate({ id: "z", name: "Heavy only", minWeightGrams: 10_000 }),
      ],
      500,
      2_000,
    );
    expect(options.map((o) => o.name)).toEqual(["Standard", "Express"]);
    expect(options[0]).toMatchObject({ price: 0, isFree: true });
    expect(options[1]).toMatchObject({ price: 15_000, isFree: false });
  });

  it("breaks price ties by name then id so order never depends on row order", () => {
    const options = evaluateRates(
      [
        rate({ id: "2", name: "B", price: 100 }),
        rate({ id: "1", name: "B", price: 100 }),
        rate({ id: "3", name: "A", price: 100 }),
      ],
      0,
      0,
    );
    expect(options.map((o) => o.rateId)).toEqual(["3", "1", "2"]);
  });
});

describe("Shipping domain: choosing an option", () => {
  const options = evaluateRates(
    [
      rate({ id: "cheap", name: "Cheap", price: 100 }),
      rate({ id: "fast", name: "Fast", price: 900 }),
    ],
    0,
    0,
  );

  it("keeps the customer's choice while it is still on offer", () => {
    expect(chooseOption(options, "fast")?.rateId).toBe("fast");
  });

  it("falls back to the cheapest for a missing, stale or foreign id", () => {
    for (const id of [null, undefined, "", "deleted-rate", "other-store-rate"]) {
      expect(chooseOption(options, id)?.rateId).toBe("cheap");
    }
  });

  it("returns null when there is nothing to choose", () => {
    expect(chooseOption([], "anything")).toBeNull();
  });
});

describe("Shipping domain: quotes", () => {
  it("quotes from the matching zone and selects the cheapest by default", () => {
    const quote = computeShippingQuote({
      zones: [zone()],
      rates: [rate({ id: "a", price: 8_000 }), rate({ id: "b", name: "Eco", price: 4_000 })],
      destination: MUMBAI,
      totalWeightGrams: 1_200,
      goodsSubtotal: 20_000,
    });
    expect(quote.zoneName).toBe("India");
    expect(quote.selected?.rateId).toBe("b");
    expect(quote.options).toHaveLength(2);
    expect(quote.totalWeightGrams).toBe(1_200);
  });

  it("honours the customer's selection", () => {
    const quote = computeShippingQuote({
      zones: [zone()],
      rates: [rate({ id: "a", price: 8_000 }), rate({ id: "b", name: "Eco", price: 4_000 })],
      destination: MUMBAI,
      totalWeightGrams: 100,
      goodsSubtotal: 100,
      selectedRateId: "a",
    });
    expect(quote.selected?.rateId).toBe("a");
  });

  it("uses the higher-priority zone when it can ship the parcel", () => {
    const quote = computeShippingQuote({
      zones: [
        zone({ id: "wide", name: "India", priority: 100 }),
        zone({ id: "local", name: "Maharashtra", stateCodes: ["27"], priority: 10 }),
      ],
      rates: [
        rate({ id: "w", zoneId: "wide", price: 9_000 }),
        rate({ id: "l", zoneId: "local", price: 2_000 }),
      ],
      destination: MUMBAI,
      totalWeightGrams: 100,
      goodsSubtotal: 100,
    });
    expect(quote.zoneName).toBe("Maharashtra");
    expect(quote.selected?.price).toBe(2_000);
  });

  it("falls through to a broader zone when the narrow one cannot take the parcel", () => {
    const quote = computeShippingQuote({
      zones: [
        zone({ id: "wide", name: "India", priority: 100 }),
        zone({ id: "local", name: "Maharashtra", stateCodes: ["27"], priority: 10 }),
      ],
      rates: [
        rate({ id: "w", zoneId: "wide", price: 9_000 }),
        // The local zone only carries parcels up to 1kg.
        rate({ id: "l", zoneId: "local", price: 2_000, maxWeightGrams: 1_000 }),
      ],
      destination: MUMBAI,
      totalWeightGrams: 5_000,
      goodsSubtotal: 100,
    });
    expect(quote.zoneName).toBe("India");
    expect(quote.selected?.price).toBe(9_000);
  });

  it("is unserviceable when no zone matches or no rate applies", () => {
    const base = { zones: [zone()], rates: [rate({ maxWeightGrams: 100 })], totalWeightGrams: 500, goodsSubtotal: 0 };
    for (const destination of [NEW_YORK, MUMBAI]) {
      const quote = computeShippingQuote({ ...base, destination });
      expect(quote.selected).toBeNull();
      expect(quote.options).toEqual([]);
      expect(quote.zoneId).toBeNull();
    }
  });

  it("bands on the discounted goods value and clamps a negative one to zero", () => {
    const rates = [rate({ minSubtotal: 1_000 })];
    const quote = computeShippingQuote({
      zones: [zone()],
      rates,
      destination: MUMBAI,
      totalWeightGrams: 0,
      goodsSubtotal: -50,
    });
    expect(quote.goodsSubtotal).toBe(0);
    expect(quote.selected).toBeNull();
  });

  it("applies free shipping from the goods value", () => {
    const rates = [rate({ price: 5_000, freeOverSubtotal: 50_000 })];
    const input = { zones: [zone()], rates, destination: MUMBAI, totalWeightGrams: 0 };
    expect(computeShippingQuote({ ...input, goodsSubtotal: 49_999 }).selected?.price).toBe(5_000);
    expect(computeShippingQuote({ ...input, goodsSubtotal: 50_000 }).selected?.price).toBe(0);
  });

  it("ignores rates belonging to a zone that does not match", () => {
    const quote = computeShippingQuote({
      zones: [zone({ id: "z1" }), zone({ id: "z2", name: "France", countryCodes: ["FR"] })],
      rates: [rate({ id: "fr", zoneId: "z2", price: 1 })],
      destination: MUMBAI,
      totalWeightGrams: 0,
      goodsSubtotal: 0,
    });
    expect(quote.selected).toBeNull();
  });
});
