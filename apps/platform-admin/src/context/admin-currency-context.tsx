"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { KNOWN_CURRENCIES, getCurrencyMetadata, type CurrencyMetadata } from "@calcart/types";

export interface AdminCurrencyContextValue {
  currentCurrency: string;
  baseCurrency: string;
  rates: Record<string, number>;
  rateDate: string;
  rateSource: "frankfurter";
  isLoading: boolean;
  setCurrency: (code: string) => void;
  formatCurrency: (cents: number, originalCurrency?: string) => string;
  convertAmount: (cents: number) => {
    amount: number;
    formatted: string;
    rate: number;
    currency: string;
  };
  supportedCurrencies: CurrencyMetadata[];
}

const AdminCurrencyContext = createContext<AdminCurrencyContextValue | null>(null);

const ADMIN_CURRENCY_STORAGE_KEY = "calcart_admin_presentment_currency";

export function AdminCurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currentCurrency, setCurrentCurrencyState] = useState<string>("INR");
  const [rates, setRates] = useState<Record<string, number>>({ INR: 1.0 });
  const [rateDate, setRateDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load live rates from Frankfurter API for base currency INR
  useEffect(() => {
    let isMounted = true;

    async function loadRates() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/platform/currencies/rates?base=INR");
        if (!res.ok) return;
        const json = await res.json();
        if (json?.data && isMounted) {
          setRates(json.data.rates || { INR: 1.0 });
          setRateDate(json.data.date || "");

          const saved = typeof window !== "undefined"
            ? localStorage.getItem(ADMIN_CURRENCY_STORAGE_KEY)
            : null;
          if (saved && (KNOWN_CURRENCIES[saved] || json.data.rates?.[saved])) {
            setCurrentCurrencyState(saved);
          }
        }
      } catch (err) {
        console.warn("Failed to load Frankfurter rates for admin console:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRates();
    return () => {
      isMounted = false;
    };
  }, []);

  const setCurrency = useCallback((code: string) => {
    const upper = code.toUpperCase();
    setCurrentCurrencyState(upper);
    if (typeof window !== "undefined") {
      localStorage.setItem(ADMIN_CURRENCY_STORAGE_KEY, upper);
    }
  }, []);

  const convertAmount = useCallback(
    (cents: number) => {
      const baseMajor = cents / 100;
      if (currentCurrency === "INR" || !rates[currentCurrency]) {
        const formatted = new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(baseMajor);

        return {
          amount: baseMajor,
          formatted,
          rate: 1.0,
          currency: "INR",
        };
      }

      const rate = rates[currentCurrency] || 1.0;
      const convertedMajor = baseMajor * rate;
      const meta = getCurrencyMetadata(currentCurrency);

      let formatted = "";
      try {
        formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currentCurrency,
          minimumFractionDigits: meta.decimals,
          maximumFractionDigits: meta.decimals,
        }).format(convertedMajor);
      } catch {
        formatted = `${meta.symbol || currentCurrency} ${convertedMajor.toFixed(meta.decimals)}`;
      }

      return {
        amount: convertedMajor,
        formatted,
        rate,
        currency: currentCurrency,
      };
    },
    [currentCurrency, rates]
  );

  const formatCurrency = useCallback(
    (cents: number, originalCurrency?: string): string => {
      // If an explicit originalCurrency is passed and equals currentCurrency, format as-is
      if (originalCurrency && originalCurrency !== "INR") {
        const meta = getCurrencyMetadata(originalCurrency);
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: originalCurrency,
          minimumFractionDigits: meta.decimals,
          maximumFractionDigits: meta.decimals,
        }).format(cents / Math.pow(10, meta.decimals));
      }

      return convertAmount(cents).formatted;
    },
    [convertAmount]
  );

  const supportedCurrencies = useMemo(() => {
    return Object.values(KNOWN_CURRENCIES);
  }, []);

  const value = useMemo(
    () => ({
      currentCurrency,
      baseCurrency: "INR",
      rates,
      rateDate,
      rateSource: "frankfurter" as const,
      isLoading,
      setCurrency,
      formatCurrency,
      convertAmount,
      supportedCurrencies,
    }),
    [
      currentCurrency,
      rates,
      rateDate,
      isLoading,
      setCurrency,
      formatCurrency,
      convertAmount,
      supportedCurrencies,
    ]
  );

  return (
    <AdminCurrencyContext.Provider value={value}>
      {children}
    </AdminCurrencyContext.Provider>
  );
}

export function useAdminCurrency(): AdminCurrencyContextValue {
  const ctx = useContext(AdminCurrencyContext);
  if (!ctx) {
    return {
      currentCurrency: "INR",
      baseCurrency: "INR",
      rates: { INR: 1.0 },
      rateDate: "",
      rateSource: "frankfurter",
      isLoading: false,
      setCurrency: () => {},
      formatCurrency: (cents: number) =>
        `₹${(cents / 100).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      convertAmount: (cents: number) => ({
        amount: cents / 100,
        formatted: `₹${(cents / 100).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        rate: 1.0,
        currency: "INR",
      }),
      supportedCurrencies: Object.values(KNOWN_CURRENCIES),
    };
  }
  return ctx;
}
