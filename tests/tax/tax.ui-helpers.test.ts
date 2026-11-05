import { describe, expect, it } from "vitest";
import {
  bpsToPercentInput,
  formatRatePercent,
  normalizeGstinInput,
  percentInputToBps,
  validateProductTaxDraft,
  validateTaxSettingsForm,
  type TaxSettingsFormData,
} from "../../apps/web/src/lib/merchant-tax-helpers.js";

function form(overrides: Partial<TaxSettingsFormData> = {}): TaxSettingsFormData {
  return {
    isEnabled: false,
    legalName: "",
    gstin: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postalCode: "",
    defaultRatePercent: "0",
    ...overrides,
  };
}

describe("Merchant tax helpers: rate conversion", () => {
  it("round-trips every common GST rate through basis points", () => {
    for (const bps of [0, 25, 100, 250, 300, 500, 1200, 1800, 2800, 4000]) {
      expect(percentInputToBps(bpsToPercentInput(bps))).toBe(bps);
    }
  });

  it("converts what a merchant types into exact basis points", () => {
    expect(percentInputToBps("18")).toBe(1800);
    expect(percentInputToBps("2.5")).toBe(250);
    expect(percentInputToBps("0.25")).toBe(25);
    expect(percentInputToBps(" 5 ")).toBe(500);
    // 0.29 * 100 is 28.999999999999996 in binary floating point.
    expect(percentInputToBps("0.29")).toBe(29);
    expect(percentInputToBps("40")).toBe(4000);
  });

  it("rejects anything that is not a plain percentage rather than rounding it", () => {
    for (const bad of ["", "abc", "-1", "41", "18.123", "1e1", "18%", "1,8", " ", "100"]) {
      expect(percentInputToBps(bad)).toBeNull();
    }
  });

  it("formats rates for display", () => {
    expect(formatRatePercent(1800)).toBe("18%");
    expect(formatRatePercent(250)).toBe("2.5%");
    expect(formatRatePercent(25)).toBe("0.25%");
    expect(bpsToPercentInput(0)).toBe("0");
  });
});

describe("Merchant tax helpers: form validation", () => {
  it("normalises a GSTIN as it is typed", () => {
    expect(normalizeGstinInput(" 27aapfu 0939f1zv ")).toBe("27AAPFU0939F1ZV");
    expect(normalizeGstinInput("27AAPFU0939F1ZVEXTRA")).toHaveLength(15);
  });

  it("accepts a disabled, empty form so a store can opt out freely", () => {
    expect(validateTaxSettingsForm(form())).toEqual({});
  });

  it("requires the registration details only once tax is being enabled", () => {
    const errors = validateTaxSettingsForm(form({ isEnabled: true }));
    expect(Object.keys(errors).sort()).toEqual([
      "addressLine1",
      "city",
      "gstin",
      "legalName",
      "postalCode",
    ]);
  });

  it("flags a malformed GSTIN and PIN code even when tax is off", () => {
    const errors = validateTaxSettingsForm(form({ gstin: "SHORT", postalCode: "12" }));
    expect(errors.gstin).toBeDefined();
    expect(errors.postalCode).toBeDefined();
  });

  it("accepts a complete, valid registration", () => {
    const errors = validateTaxSettingsForm(
      form({
        isEnabled: true,
        legalName: "Acme Traders Pvt Ltd",
        gstin: "27AAPFU0939F1ZV",
        addressLine1: "12 Market Road",
        city: "Mumbai",
        postalCode: "400001",
        defaultRatePercent: "18",
      }),
    );
    expect(errors).toEqual({});
  });

  it("rejects an invalid default rate", () => {
    expect(validateTaxSettingsForm(form({ defaultRatePercent: "99" })).defaultRatePercent).toBeDefined();
  });

  it("validates a product's HSN code and rate", () => {
    expect(validateProductTaxDraft({ hsnCode: "6109", ratePercent: "5" })).toEqual({});
    expect(validateProductTaxDraft({ hsnCode: "61091000", ratePercent: "0.25" })).toEqual({});
    expect(validateProductTaxDraft({ hsnCode: "12", ratePercent: "5" }).hsnCode).toBeDefined();
    expect(validateProductTaxDraft({ hsnCode: "6109", ratePercent: "x" }).ratePercent).toBeDefined();
  });
});
