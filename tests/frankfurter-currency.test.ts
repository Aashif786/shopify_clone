import { describe, it, expect } from "vitest";
import {
  fetchFrankfurterRates,
  fetchFrankfurterRate,
  KNOWN_CURRENCIES,
  getCurrencyMetadata,
} from "@calcart/types";

describe("Frankfurter Currency Integration", () => {
  it("fetches live rates for USD and returns valid quotes", async () => {
    const result = await fetchFrankfurterRates("USD");

    expect(result.source).toBe("frankfurter");
    expect(result.base).toBe("USD");
    expect(result.rates.USD).toBe(1.0);
    expect(typeof result.rates.EUR).toBe("number");
    expect(result.rates.EUR).toBeGreaterThan(0);
    expect(typeof result.rates.INR).toBe("number");
    expect(result.rates.INR).toBeGreaterThan(0);
    expect(typeof result.date).toBe("string");
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("fetches live rates for INR and returns target quotes including USD, EUR, GBP", async () => {
    const result = await fetchFrankfurterRates("INR");

    expect(result.source).toBe("frankfurter");
    expect(result.base).toBe("INR");
    expect(result.rates.INR).toBe(1.0);
    expect(typeof result.rates.USD).toBe("number");
    expect(result.rates.USD).toBeGreaterThan(0);
    expect(typeof result.rates.EUR).toBe("number");
    expect(result.rates.EUR).toBeGreaterThan(0);
  });

  it("returns cached results on subsequent calls without throwing", async () => {
    const first = await fetchFrankfurterRates("USD");
    const second = await fetchFrankfurterRates("USD");

    expect(second.rates).toEqual(first.rates);
    expect(second.date).toBe(first.date);
  });

  it("fetches single rate correctly via fetchFrankfurterRate", async () => {
    const rateItem = await fetchFrankfurterRate("USD", "EUR");

    expect(rateItem.source).toBe("frankfurter");
    expect(typeof rateItem.rate).toBe("number");
    expect(rateItem.rate).toBeGreaterThan(0);
    expect(typeof rateItem.date).toBe("string");
  });

  it("returns 1.0 immediately for identical base and quote", async () => {
    const rateItem = await fetchFrankfurterRate("EUR", "EUR");

    expect(rateItem.rate).toBe(1.0);
    expect(rateItem.source).toBe("frankfurter");
  });

  it("provides metadata for known global currencies", () => {
    expect(KNOWN_CURRENCIES.INR.symbol).toBe("₹");
    expect(KNOWN_CURRENCIES.USD.symbol).toBe("$");
    expect(KNOWN_CURRENCIES.EUR.symbol).toBe("€");
    expect(KNOWN_CURRENCIES.GBP.symbol).toBe("£");

    const meta = getCurrencyMetadata("AED");
    expect(meta.code).toBe("AED");
    expect(meta.decimals).toBe(2);
  });
});
