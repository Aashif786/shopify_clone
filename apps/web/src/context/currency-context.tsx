"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { StoreCurrencyDTO, StoreCurrenciesResponseDTO } from "@calcart/types";
import { convertMinorUnits, formatCurrency, getCurrencyMetadata } from "../lib/currency";

export interface ConvertedPriceResult {
  presentmentAmountMinor: number;
  presentmentFormatted: string;
  isConverted: boolean;
  baseAmountMinor: number;
  baseFormatted: string;
  presentmentCurrency: string;
  baseCurrency: string;
}

export interface CurrencyContextValue {
  currentCurrency: string;
  baseCurrency: string;
  currencies: StoreCurrencyDTO[];
  isLoading: boolean;
  setCurrency: (code: string) => void;
  formatPrice: (amountMinor: number, customCurrency?: string) => string;
  convertPrice: (amountMinor: number) => ConvertedPriceResult;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const STORAGE_KEY = "calcart_presentment_currency";

export function CurrencyProvider({
  children,
  storeSlug,
  initialBaseCurrency = "INR",
}: {
  children: React.ReactNode;
  storeSlug?: string;
  initialBaseCurrency?: string;
}) {
  const [baseCurrency, setBaseCurrency] = useState<string>(initialBaseCurrency);
  const [currentCurrency, setCurrentCurrencyState] = useState<string>(initialBaseCurrency);
  const [currencies, setCurrencies] = useState<StoreCurrencyDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load configured currencies for the store
  useEffect(() => {
    if (!storeSlug) return;
    let isMounted = true;

    async function loadCurrencies() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/v1/storefront/${storeSlug}/currencies`);
        if (!res.ok) return;
        const json = await res.json();
        if (json?.data && isMounted) {
          const data = json.data as StoreCurrenciesResponseDTO;
          setBaseCurrency(data.baseCurrency);
          setCurrencies(data.currencies);

          // Check if there is a saved preference
          const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
          if (saved && data.currencies.some((c) => c.currency === saved && c.isEnabled)) {
            setCurrentCurrencyState(saved);
          } else {
            setCurrentCurrencyState(data.baseCurrency);
          }
        }
      } catch (err) {
        console.error("Failed to load storefront currencies:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadCurrencies();
    return () => {
      isMounted = false;
    };
  }, [storeSlug]);

  const setCurrency = useCallback((code: string) => {
    const upper = code.toUpperCase();
    setCurrentCurrencyState(upper);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, upper);
      // Also set cookie for SSR / next requests
      document.cookie = `${STORAGE_KEY}=${upper}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, []);

  const activeCurrencyConfig = useMemo(() => {
    return currencies.find((c) => c.currency === currentCurrency);
  }, [currencies, currentCurrency]);

  const convertPrice = useCallback(
    (amountMinor: number): ConvertedPriceResult => {
      const baseMeta = getCurrencyMetadata(baseCurrency);
      const targetMeta = getCurrencyMetadata(currentCurrency);

      const baseFormatted = formatCurrency(amountMinor, baseCurrency);

      if (currentCurrency === baseCurrency || !activeCurrencyConfig) {
        return {
          presentmentAmountMinor: amountMinor,
          presentmentFormatted: baseFormatted,
          isConverted: false,
          baseAmountMinor: amountMinor,
          baseFormatted,
          presentmentCurrency: baseCurrency,
          baseCurrency,
        };
      }

      const convertedMinor = convertMinorUnits({
        amountMinor,
        exchangeRate: activeCurrencyConfig.exchangeRate,
        baseDecimals: baseMeta.decimals,
        targetDecimals: targetMeta.decimals,
        roundingRule: activeCurrencyConfig.roundingRule,
      });

      const presentmentFormatted = formatCurrency(convertedMinor, currentCurrency);

      return {
        presentmentAmountMinor: convertedMinor,
        presentmentFormatted,
        isConverted: true,
        baseAmountMinor: amountMinor,
        baseFormatted,
        presentmentCurrency: currentCurrency,
        baseCurrency,
      };
    },
    [baseCurrency, currentCurrency, activeCurrencyConfig]
  );

  const formatPrice = useCallback(
    (amountMinor: number, customCurrency?: string): string => {
      if (customCurrency) {
        return formatCurrency(amountMinor, customCurrency);
      }
      return convertPrice(amountMinor).presentmentFormatted;
    },
    [convertPrice]
  );

  const value = useMemo(
    () => ({
      currentCurrency,
      baseCurrency,
      currencies,
      isLoading,
      setCurrency,
      formatPrice,
      convertPrice,
    }),
    [currentCurrency, baseCurrency, currencies, isLoading, setCurrency, formatPrice, convertPrice]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    // Return a safe fallback context if rendered outside provider
    return {
      currentCurrency: "INR",
      baseCurrency: "INR",
      currencies: [],
      isLoading: false,
      setCurrency: () => {},
      formatPrice: (amt) => formatCurrency(amt, "INR"),
      convertPrice: (amt) => ({
        presentmentAmountMinor: amt,
        presentmentFormatted: formatCurrency(amt, "INR"),
        isConverted: false,
        baseAmountMinor: amt,
        baseFormatted: formatCurrency(amt, "INR"),
        presentmentCurrency: "INR",
        baseCurrency: "INR",
      }),
    };
  }
  return ctx;
}
