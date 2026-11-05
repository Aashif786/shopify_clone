import { describe, expect, it } from "vitest";
import {
  allocateByWeight,
  amountInWordsInr,
  calculateGst,
  computeGstinCheckChar,
  determineSupply,
  financialYearCode,
  financialYearLabel,
  formatGstRate,
  formatInvoiceNumber,
  gstStateName,
  InvalidGstRateError,
  InvalidPlaceOfSupplyError,
  InvoiceNumberExhaustedError,
  isIndiaCountry,
  isValidGstin,
  renderTaxInvoiceHtml,
  resolveGstStateCode,
  type GstLineInput,
  type TaxInvoiceDTO,
} from "@calcart/tax";

/** Builds a structurally valid GSTIN with a correct check character. */
function makeGstin(stateCode: string, pan: string, entity = "1"): string {
  const first14 = `${stateCode}${pan}${entity}Z`;
  return `${first14}${computeGstinCheckChar(first14)}`;
}

function line(overrides: Partial<GstLineInput> = {}): GstLineInput {
  return {
    lineId: "line-1",
    productId: "prod-1",
    hsnCode: "6109",
    rateBps: 1800,
    unitPrice: 10_000,
    quantity: 1,
    ...overrides,
  };
}

describe("Tax domain: discount allocation", () => {
  it("always sums to exactly the total, losing and inventing no minor unit", () => {
    const weights = [3333, 3333, 3334];
    for (const total of [0, 1, 2, 99, 100, 101, 9999, 10_000]) {
      const parts = allocateByWeight(total, weights);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it("allocates proportionally and breaks ties toward the earlier line", () => {
    // 100 over three equal weights: 33 each with one leftover unit, to line 0.
    expect(allocateByWeight(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateByWeight(10, [1, 3])).toEqual([3, 7]);
  });

  it("never gives a unit to a zero-weight line", () => {
    const parts = allocateByWeight(5, [0, 10, 0, 10]);
    expect(parts[0]).toBe(0);
    expect(parts[2]).toBe(0);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(5);
  });

  it("stays exact where a plain Number product would exceed 2^53", () => {
    // 9e12 x 9e12 = 8.1e25, far past Number.MAX_SAFE_INTEGER.
    const parts = allocateByWeight(9_000_000_000_000, [
      4_500_000_000_000,
      4_500_000_000_000,
    ]);
    expect(parts).toEqual([4_500_000_000_000, 4_500_000_000_000]);
  });

  it("allocates nothing for a zero total and rejects an impossible allocation", () => {
    expect(allocateByWeight(0, [5, 5])).toEqual([0, 0]);
    expect(allocateByWeight(10, [])).toEqual([]);
    expect(() => allocateByWeight(10, [0, 0])).toThrow();
    expect(() => allocateByWeight(-1, [1])).toThrow();
    expect(() => allocateByWeight(1, [1.5])).toThrow();
  });
});

describe("Tax domain: GSTIN", () => {
  it("accepts a GSTIN with a correct check character", () => {
    expect(isValidGstin(makeGstin("27", "AAPFU0939F"))).toBe(true);
    expect(isValidGstin(makeGstin("29", "ABCDE1234F"))).toBe(true);
  });

  it("accepts the widely published sample GSTIN, validating the algorithm itself", () => {
    // Guards against the checksum being self-consistent but wrong.
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
  });

  it("is case-insensitive and ignores surrounding whitespace", () => {
    const gstin = makeGstin("27", "AAPFU0939F");
    expect(isValidGstin(`  ${gstin.toLowerCase()} `)).toBe(true);
  });

  it("rejects a typo in any single character", () => {
    const gstin = makeGstin("27", "AAPFU0939F");
    // Mutate the PAN digits (skipping Z at position 13) and confirm rejection.
    const mutated = `${gstin.slice(0, 7)}${gstin[7] === "0" ? "1" : "0"}${gstin.slice(8)}`;
    expect(isValidGstin(mutated)).toBe(false);
  });

  it("rejects a wrong check character, a bad state prefix, and malformed input", () => {
    const gstin = makeGstin("27", "AAPFU0939F");
    const wrongCheck = `${gstin.slice(0, 14)}${gstin[14] === "A" ? "B" : "A"}`;
    expect(isValidGstin(wrongCheck)).toBe(false);

    // 99 is not a GST state code, even with a self-consistent checksum.
    expect(isValidGstin(makeGstin("99", "AAPFU0939F"))).toBe(false);

    for (const bad of ["", "SHORT", "27AAPFU0939F1Z", null, undefined, "27aapfu0939f1z!"]) {
      expect(isValidGstin(bad as string)).toBe(false);
    }
  });
});

describe("Tax domain: place of supply", () => {
  it("resolves full names, aliases, abbreviations and numeric codes", () => {
    expect(resolveGstStateCode("Maharashtra")).toBe("27");
    expect(resolveGstStateCode("  karnataka ")).toBe("29");
    expect(resolveGstStateCode("TAMIL NADU")).toBe("33");
    expect(resolveGstStateCode("Tamilnadu")).toBe("33");
    expect(resolveGstStateCode("Orissa")).toBe("21");
    expect(resolveGstStateCode("Pondicherry")).toBe("34");
    expect(resolveGstStateCode("Jammu & Kashmir")).toBe("01");
    expect(resolveGstStateCode("NCT of Delhi")).toBe("07");
    expect(resolveGstStateCode("MH")).toBe("27");
    expect(resolveGstStateCode("dl")).toBe("07");
    expect(resolveGstStateCode("27")).toBe("27");
  });

  it("returns null rather than guessing at unknown input", () => {
    for (const bad of ["Atlantis", "", "   ", "99", "ZZ", null, undefined, "28"]) {
      expect(resolveGstStateCode(bad as string)).toBeNull();
    }
  });

  it("exposes the state name for a code", () => {
    expect(gstStateName("27")).toBe("Maharashtra");
    expect(gstStateName("99")).toBeNull();
    expect(gstStateName(null)).toBeNull();
  });

  it("recognises every common spelling of India", () => {
    for (const country of ["India", "IN", "in", "IND", " india ", "Bharat"]) {
      expect(isIndiaCountry(country)).toBe(true);
    }
    for (const country of ["USA", "", "Indonesia", null, undefined]) {
      expect(isIndiaCountry(country as string)).toBe(false);
    }
  });

  it("classifies intra-state, inter-state and export supplies", () => {
    expect(
      determineSupply("27", { country: "India", state: "Maharashtra" }),
    ).toEqual({ supplyType: "INTRA_STATE", placeOfSupplyCode: "27" });
    expect(
      determineSupply("27", { country: "IN", state: "Karnataka" }),
    ).toEqual({ supplyType: "INTER_STATE", placeOfSupplyCode: "29" });
    expect(
      determineSupply("27", { country: "United States", state: "California" }),
    ).toEqual({ supplyType: "EXPORT", placeOfSupplyCode: null });
  });

  it("rejects an Indian destination whose state cannot be resolved", () => {
    expect(() =>
      determineSupply("27", { country: "India", state: "Atlantis" }),
    ).toThrow(InvalidPlaceOfSupplyError);
    expect(() =>
      determineSupply("27", { country: "India", state: "" }),
    ).toThrow(InvalidPlaceOfSupplyError);
    expect(() =>
      determineSupply("27", { country: "India", state: null }),
    ).toThrow(InvalidPlaceOfSupplyError);
  });
});

describe("Tax domain: GST calculation", () => {
  const intra = { country: "India", state: "Maharashtra" };
  const inter = { country: "India", state: "Karnataka" };

  it("splits an intra-state sale into equal CGST and SGST halves", () => {
    const result = calculateGst({
      sellerStateCode: "27",
      destination: intra,
      lines: [line({ unitPrice: 10_000, quantity: 1, rateBps: 1800 })],
      discountTotal: 0,
    });

    expect(result.supplyType).toBe("INTRA_STATE");
    expect(result.cgstTotal).toBe(900);
    expect(result.sgstTotal).toBe(900);
    expect(result.igstTotal).toBe(0);
    expect(result.taxTotal).toBe(1800);
    expect(result.lines[0]?.taxAmount).toBe(1800);
  });

  it("charges IGST alone on an inter-state sale", () => {
    const result = calculateGst({
      sellerStateCode: "27",
      destination: inter,
      lines: [line({ unitPrice: 10_000, rateBps: 1800 })],
      discountTotal: 0,
    });

    expect(result.supplyType).toBe("INTER_STATE");
    expect(result.cgstTotal).toBe(0);
    expect(result.sgstTotal).toBe(0);
    expect(result.igstTotal).toBe(1800);
    expect(result.taxTotal).toBe(1800);
  });

  it("charges no Indian GST on an export", () => {
    const result = calculateGst({
      sellerStateCode: "27",
      destination: { country: "United States", state: "California" },
      lines: [line()],
      discountTotal: 0,
    });
    expect(result.supplyType).toBe("EXPORT");
    expect(result.placeOfSupplyCode).toBeNull();
    expect(result.taxTotal).toBe(0);
  });

  it("keeps CGST and SGST equal even when the half-rate rounds", () => {
    // 1001 at 5% is 50.05, so each half is 25.025 and rounds to 25. The two
    // heads are computed once and applied to both, so they can never differ.
    const result = calculateGst({
      sellerStateCode: "27",
      destination: intra,
      lines: [line({ unitPrice: 1001, rateBps: 500 })],
      discountTotal: 0,
    });
    expect(result.cgstTotal).toBe(25);
    expect(result.sgstTotal).toBe(25);
    expect(result.cgstTotal).toBe(result.sgstTotal);
    expect(result.taxTotal).toBe(50);
  });

  it("handles fractional-percent rates exactly through basis points", () => {
    // 0.25% (25 bps) of 100000 is 250, split 125 / 125.
    const result = calculateGst({
      sellerStateCode: "27",
      destination: intra,
      lines: [line({ unitPrice: 100_000, rateBps: 25 })],
      discountTotal: 0,
    });
    expect(result.cgstTotal).toBe(125);
    expect(result.sgstTotal).toBe(125);
    expect(result.taxTotal).toBe(250);
  });

  it("levies tax on the discounted value, not the list price", () => {
    const result = calculateGst({
      sellerStateCode: "27",
      destination: intra,
      lines: [line({ unitPrice: 10_000, rateBps: 1800 })],
      discountTotal: 2_000,
    });
    expect(result.lines[0]?.discountAmount).toBe(2_000);
    expect(result.lines[0]?.taxableValue).toBe(8_000);
    expect(result.taxableTotal).toBe(8_000);
    expect(result.taxTotal).toBe(1_440);
  });

  it("allocates a checkout discount across lines and applies each line's own rate", () => {
    const result = calculateGst({
      sellerStateCode: "27",
      destination: inter,
      lines: [
        line({ lineId: "a", unitPrice: 6_000, quantity: 1, rateBps: 500 }),
        line({ lineId: "b", unitPrice: 4_000, quantity: 1, rateBps: 1800 }),
      ],
      discountTotal: 1_000,
    });

    // 1000 split 600 / 400 in proportion to 6000 / 4000.
    expect(result.lines[0]?.discountAmount).toBe(600);
    expect(result.lines[1]?.discountAmount).toBe(400);
    expect(result.lines[0]?.taxableValue).toBe(5_400);
    expect(result.lines[1]?.taxableValue).toBe(3_600);
    expect(result.lines[0]?.igst).toBe(270); // 5% of 5400
    expect(result.lines[1]?.igst).toBe(648); // 18% of 3600
    expect(result.igstTotal).toBe(918);
  });

  it("keeps line figures consistent with the totals", () => {
    const result = calculateGst({
      sellerStateCode: "27",
      destination: intra,
      lines: [
        line({ lineId: "a", unitPrice: 333, quantity: 3, rateBps: 1200 }),
        line({ lineId: "b", unitPrice: 1_999, quantity: 2, rateBps: 1800 }),
        line({ lineId: "c", unitPrice: 50, quantity: 7, rateBps: 0 }),
      ],
      discountTotal: 777,
    });

    const sum = (pick: (l: (typeof result.lines)[number]) => number) =>
      result.lines.reduce((total, l) => total + pick(l), 0);

    expect(sum((l) => l.grossAmount)).toBe(result.subtotal);
    expect(sum((l) => l.discountAmount)).toBe(result.discountTotal);
    expect(sum((l) => l.taxableValue)).toBe(result.taxableTotal);
    expect(sum((l) => l.cgst)).toBe(result.cgstTotal);
    expect(sum((l) => l.sgst)).toBe(result.sgstTotal);
    expect(result.cgstTotal + result.sgstTotal + result.igstTotal).toBe(
      result.taxTotal,
    );
    expect(result.subtotal - result.discountTotal).toBe(result.taxableTotal);
  });

  it("charges nothing on a zero-rated line and still totals correctly", () => {
    const result = calculateGst({
      sellerStateCode: "27",
      destination: intra,
      lines: [line({ rateBps: 0 })],
      discountTotal: 0,
    });
    expect(result.taxTotal).toBe(0);
    expect(result.taxableTotal).toBe(10_000);
  });

  it("clamps a discount that exceeds the subtotal instead of going negative", () => {
    const result = calculateGst({
      sellerStateCode: "27",
      destination: intra,
      lines: [line({ unitPrice: 5_000 })],
      discountTotal: 999_999,
    });
    expect(result.discountTotal).toBe(5_000);
    expect(result.taxableTotal).toBe(0);
    expect(result.taxTotal).toBe(0);
  });

  it("handles an empty basket without error", () => {
    const result = calculateGst({
      sellerStateCode: "27",
      destination: intra,
      lines: [],
      discountTotal: 0,
    });
    expect(result.taxTotal).toBe(0);
    expect(result.lines).toEqual([]);
  });

  it("rejects out-of-range rates and invalid quantities and prices", () => {
    for (const rateBps of [-1, 4001, 12.5, Number.NaN]) {
      expect(() =>
        calculateGst({
          sellerStateCode: "27",
          destination: intra,
          lines: [line({ rateBps })],
          discountTotal: 0,
        }),
      ).toThrow(InvalidGstRateError);
    }
    expect(() =>
      calculateGst({
        sellerStateCode: "27",
        destination: intra,
        lines: [line({ quantity: 0 })],
        discountTotal: 0,
      }),
    ).toThrow();
    expect(() =>
      calculateGst({
        sellerStateCode: "27",
        destination: intra,
        lines: [line({ unitPrice: -1 })],
        discountTotal: 0,
      }),
    ).toThrow();
  });

  it("refuses to calculate for an unresolvable Indian state", () => {
    expect(() =>
      calculateGst({
        sellerStateCode: "27",
        destination: { country: "India", state: "Atlantis" },
        lines: [line()],
        discountTotal: 0,
      }),
    ).toThrow(InvalidPlaceOfSupplyError);
  });

  it("formats rates for display", () => {
    expect(formatGstRate(1800)).toBe("18%");
    expect(formatGstRate(500)).toBe("5%");
    expect(formatGstRate(250)).toBe("2.5%");
    expect(formatGstRate(25)).toBe("0.25%");
    expect(formatGstRate(0)).toBe("0%");
  });
});

describe("Tax domain: invoice numbering", () => {
  it("rolls the financial year over at midnight IST on 1 April, not UTC", () => {
    // 23:59:59 IST on 31 March 2026 is still FY 2025-26...
    expect(financialYearCode(new Date("2026-03-31T18:29:59.000Z"))).toBe("2526");
    // ...and one second later it is 00:00:00 IST on 1 April: FY 2026-27.
    expect(financialYearCode(new Date("2026-03-31T18:30:00.000Z"))).toBe("2627");
  });

  it("maps dates across the year to the right financial year", () => {
    expect(financialYearCode(new Date("2026-04-01T12:00:00.000Z"))).toBe("2627");
    expect(financialYearCode(new Date("2026-11-05T12:00:00.000Z"))).toBe("2627");
    expect(financialYearCode(new Date("2027-01-15T12:00:00.000Z"))).toBe("2627");
    expect(financialYearCode(new Date("2027-04-01T12:00:00.000Z"))).toBe("2728");
    expect(financialYearCode(new Date("2099-12-31T12:00:00.000Z"))).toBe("9900");
  });

  it("labels a financial year for display", () => {
    expect(financialYearLabel("2627")).toBe("2026-27");
    expect(financialYearLabel("2526")).toBe("2025-26");
  });

  it("formats within the 16-character legal limit", () => {
    const first = formatInvoiceNumber("2627", 1);
    expect(first).toBe("INV/2627/000001");
    expect(first.length).toBeLessThanOrEqual(16);
    expect(first).toMatch(/^[A-Za-z0-9/-]{1,16}$/);
  });

  it("widens to seven digits at exactly 16 characters, then refuses to truncate", () => {
    const seven = formatInvoiceNumber("2627", 1_000_000);
    expect(seven).toBe("INV/2627/1000000");
    expect(seven.length).toBe(16);

    expect(() => formatInvoiceNumber("2627", 10_000_000)).toThrow(
      InvoiceNumberExhaustedError,
    );
  });

  it("rejects a non-positive or fractional sequence", () => {
    for (const sequence of [0, -1, 1.5]) {
      expect(() => formatInvoiceNumber("2627", sequence)).toThrow();
    }
  });
});

describe("Tax domain: amount in words", () => {
  it("writes rupees and paise in the Indian numbering system", () => {
    expect(amountInWordsInr(0)).toBe("Rupees Zero Only");
    expect(amountInWordsInr(100)).toBe("Rupees One Only");
    expect(amountInWordsInr(123_456)).toBe(
      "Rupees One Thousand Two Hundred Thirty Four and Fifty Six Paise Only",
    );
    expect(amountInWordsInr(5)).toBe("Rupees Zero and Five Paise Only");
  });

  it("uses lakh and crore rather than millions", () => {
    expect(amountInWordsInr(10_000_000)).toBe("Rupees One Lakh Only");
    expect(amountInWordsInr(1_000_000_000)).toBe("Rupees One Crore Only");
    expect(amountInWordsInr(123_456_789)).toBe(
      "Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven and Eighty Nine Paise Only",
    );
  });

  it("rejects negative and fractional amounts", () => {
    expect(() => amountInWordsInr(-1)).toThrow();
    expect(() => amountInWordsInr(1.5)).toThrow();
  });
});

describe("Tax domain: invoice rendering", () => {
  function invoice(overrides: Partial<TaxInvoiceDTO> = {}): TaxInvoiceDTO {
    return {
      id: "inv-1",
      storeId: "store-1",
      orderId: "order-1",
      invoiceNumber: "INV/2627/000001",
      financialYear: "2627",
      issuedAt: "2026-11-05T06:30:00.000Z",
      currency: "INR",
      supplyType: "INTRA_STATE",
      placeOfSupplyCode: "27",
      placeOfSupplyName: "Maharashtra",
      seller: {
        legalName: "Acme Traders Pvt Ltd",
        gstin: makeGstin("27", "AAPFU0939F"),
        stateCode: "27",
        stateName: "Maharashtra",
        addressLine1: "12 Market Road",
        addressLine2: null,
        city: "Mumbai",
        postalCode: "400001",
      },
      buyer: {
        name: "Alex Buyer",
        addressLine1: "5 Lake View",
        city: "Pune",
        state: "Maharashtra",
        postalCode: "411001",
        country: "India",
      },
      subtotal: 10_000,
      discountTotal: 0,
      taxableTotal: 10_000,
      cgstTotal: 900,
      sgstTotal: 900,
      igstTotal: 0,
      taxTotal: 1_800,
      shippingTotal: 0,
      grandTotal: 11_800,
      lines: [
        {
          id: "l1",
          lineNumber: 1,
          orderItemId: null,
          description: "Cotton T-Shirt",
          hsnCode: "6109",
          quantity: 1,
          unitPrice: 10_000,
          discount: 0,
          taxableValue: 10_000,
          gstRateBps: 1800,
          cgst: 900,
          sgst: 900,
          igst: 0,
          lineTotal: 11_800,
        },
      ],
      ...overrides,
    };
  }

  it("shows CGST and SGST columns for an intra-state supply", () => {
    const html = renderTaxInvoiceHtml(invoice());
    expect(html).toContain("TAX INVOICE");
    expect(html).toContain("INV/2627/000001");
    expect(html).toContain("CGST");
    expect(html).toContain("SGST");
    expect(html).not.toContain(">IGST<");
    expect(html).toContain("6109");
    expect(html).toContain("Maharashtra (27)");
    expect(html).toContain("Reverse charge:</strong> No");
    expect(html).toContain("Rupees One Hundred Eighteen Only");
  });

  it("shows a single IGST column for an inter-state supply", () => {
    const html = renderTaxInvoiceHtml(
      invoice({
        supplyType: "INTER_STATE",
        placeOfSupplyCode: "29",
        placeOfSupplyName: "Karnataka",
        cgstTotal: 0,
        sgstTotal: 0,
        igstTotal: 1_800,
        lines: [
          {
            ...invoice().lines[0]!,
            cgst: 0,
            sgst: 0,
            igst: 1_800,
          },
        ],
      }),
    );
    expect(html).toContain("IGST");
    expect(html).not.toContain(">CGST<");
    expect(html).not.toContain(">SGST<");
    expect(html).toContain("Karnataka (29)");
  });

  it("notes an export and omits the tax columns", () => {
    const html = renderTaxInvoiceHtml(
      invoice({
        supplyType: "EXPORT",
        placeOfSupplyCode: null,
        placeOfSupplyName: null,
        cgstTotal: 0,
        sgstTotal: 0,
        igstTotal: 0,
        taxTotal: 0,
        grandTotal: 10_000,
      }),
    );
    expect(html).toContain("Supply meant for export");
    expect(html).toContain("Outside India");
  });

  it("HTML-escapes every interpolated value", () => {
    const html = renderTaxInvoiceHtml(
      invoice({
        seller: {
          ...invoice().seller,
          legalName: `Evil <script>alert("x")</script> & Co`,
        },
        buyer: {
          ...invoice().buyer,
          name: `<img src=x onerror=alert(1)>`,
        },
        lines: [
          {
            ...invoice().lines[0]!,
            description: `<b>bold</b> "quoted" 'single'`,
          },
        ],
      }),
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; Co");
    expect(html).toContain("&quot;quoted&quot;");
  });

  it("omits the amount in words for a non-INR invoice", () => {
    const html = renderTaxInvoiceHtml(invoice({ currency: "USD" }));
    expect(html).not.toContain("Amount in words");
  });
});
