import { describe, expect, it } from "vitest";
import {
  EMPTY_RATE_FORM,
  EMPTY_ZONE_FORM,
  describeWeightBand,
  formatGrams,
  minorToMoneyInput,
  parseGrams,
  parseList,
  parseMoneyToMinor,
  rateFormToPayload,
  validateRateForm,
  validateZoneForm,
  zoneFormToPayload,
} from "../../apps/web/src/lib/merchant-shipping-helpers.js";

const baseRate = (over: Partial<typeof EMPTY_RATE_FORM> = {}) => ({
  ...EMPTY_RATE_FORM,
  name: "Standard",
  price: "50",
  ...over,
});

describe("Merchant shipping helpers: money", () => {
  it("converts rupees to exact minor units without floating point", () => {
    expect(parseMoneyToMinor("50")).toBe(5000);
    expect(parseMoneyToMinor("49.5")).toBe(4950);
    expect(parseMoneyToMinor("49.50")).toBe(4950);
    expect(parseMoneyToMinor("0.05")).toBe(5);
    expect(parseMoneyToMinor("0.29")).toBe(29); // 0.29 * 100 is 28.999... in floats
    expect(parseMoneyToMinor(" 1 ")).toBe(100);
    expect(parseMoneyToMinor("0")).toBe(0);
  });

  it("rejects anything that is not a plain amount", () => {
    for (const bad of ["", "abc", "-1", "1.234", "1,5", "1e3", "₹50", " ", "1.", ".5", "9999999999"]) {
      expect(parseMoneyToMinor(bad)).toBeNull();
    }
  });

  it("round-trips through the input format", () => {
    for (const minor of [0, 5, 99, 100, 4950, 5000, 123456]) {
      expect(parseMoneyToMinor(minorToMoneyInput(minor))).toBe(minor);
    }
    expect(minorToMoneyInput(5000)).toBe("50");
    expect(minorToMoneyInput(4905)).toBe("49.05");
  });
});

describe("Merchant shipping helpers: weight and lists", () => {
  it("parses whole grams only", () => {
    expect(parseGrams("1500")).toBe(1500);
    expect(parseGrams(" 0 ")).toBe(0);
    for (const bad of ["", "1.5", "-5", "kg", "100000001", "1e3"]) {
      expect(parseGrams(bad)).toBeNull();
    }
  });

  it("formats grams readably", () => {
    expect(formatGrams(250)).toBe("250 g");
    expect(formatGrams(1000)).toBe("1 kg");
    expect(formatGrams(1500)).toBe("1.5 kg");
    expect(formatGrams(1250)).toBe("1.25 kg");
  });

  it("splits comma and line lists, trimming, deduplicating and dropping blanks", () => {
    expect(parseList("Maharashtra, Karnataka\n MH ,, Maharashtra")).toEqual([
      "Maharashtra",
      "Karnataka",
      "MH",
    ]);
    expect(parseList("")).toEqual([]);
  });
});

describe("Merchant shipping helpers: zone form", () => {
  it("accepts a sensible zone and builds the payload", () => {
    const form = { ...EMPTY_ZONE_FORM, name: " South ", states: "Karnataka, TN", postalPrefixes: "560, 600" };
    expect(validateZoneForm(form)).toEqual({});
    expect(zoneFormToPayload(form)).toEqual({
      name: "South",
      countryCodes: ["India"],
      stateCodes: ["Karnataka", "TN"],
      postalPrefixes: ["560", "600"],
      priority: 100,
      isActive: true,
    });
  });

  it("flags a blank name and a bad priority", () => {
    const errors = validateZoneForm({ ...EMPTY_ZONE_FORM, name: " ", priority: "-1" });
    expect(errors.name).toBeDefined();
    expect(errors.priority).toBeDefined();
  });
});

describe("Merchant shipping helpers: rate form", () => {
  it("accepts a minimal rate and converts it to minor units and grams", () => {
    expect(validateRateForm(baseRate())).toEqual({});
    expect(rateFormToPayload(baseRate())).toMatchObject({
      name: "Standard",
      price: 5000,
      minWeightGrams: 0,
      maxWeightGrams: null,
      minSubtotal: 0,
      maxSubtotal: null,
      freeOverSubtotal: null,
      estimatedDaysMin: null,
      estimatedDaysMax: null,
    });
  });

  it("converts every band field", () => {
    const form = baseRate({
      minWeight: "500", maxWeight: "2000", minSubtotal: "100", maxSubtotal: "999.50",
      freeOver: "1500", daysMin: "2", daysMax: "5",
    });
    expect(validateRateForm(form)).toEqual({});
    expect(rateFormToPayload(form)).toMatchObject({
      minWeightGrams: 500, maxWeightGrams: 2000, minSubtotal: 10000, maxSubtotal: 99950,
      freeOverSubtotal: 150000, estimatedDaysMin: 2, estimatedDaysMax: 5,
    });
  });

  it("requires a name and a valid price", () => {
    const errors = validateRateForm({ ...EMPTY_RATE_FORM });
    expect(errors.name).toBeDefined();
    expect(errors.price).toBeDefined();
    expect(validateRateForm(baseRate({ price: "5.123" })).price).toBeDefined();
  });

  it("catches inverted bands before the server does", () => {
    expect(validateRateForm(baseRate({ minWeight: "500", maxWeight: "100" })).maxWeight).toBeDefined();
    expect(validateRateForm(baseRate({ minSubtotal: "100", maxSubtotal: "50" })).maxSubtotal).toBeDefined();
    expect(validateRateForm(baseRate({ daysMin: "5", daysMax: "2" })).daysMax).toBeDefined();
  });

  it("rejects malformed band values individually", () => {
    const errors = validateRateForm(baseRate({ minWeight: "1.5", freeOver: "abc", daysMin: "x" }));
    expect(errors.minWeight).toBeDefined();
    expect(errors.freeOver).toBeDefined();
    expect(errors.daysMin).toBeDefined();
  });

  it("describes weight bands", () => {
    const rate = (min: number, max: number | null) =>
      ({ minWeightGrams: min, maxWeightGrams: max }) as never;
    expect(describeWeightBand(rate(0, null))).toBe("Any weight");
    expect(describeWeightBand(rate(0, 2000))).toBe("Up to 2 kg");
    expect(describeWeightBand(rate(500, null))).toBe("From 500 g");
    expect(describeWeightBand(rate(500, 2000))).toBe("500 g to 2 kg");
  });
});
