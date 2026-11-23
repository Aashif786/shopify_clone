"use client";

import React, { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import { useAdminCurrency } from "../context/admin-currency-context";

export function AdminCurrencySelector() {
  const {
    currentCurrency,
    rates,
    rateDate,
    setCurrency,
    supportedCurrencies,
  } = useAdminCurrency();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const activeMeta = supportedCurrencies.find((c) => c.code === currentCurrency);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all focus:outline-none"
        title="Change platform display currency (Live Frankfurter FX)"
      >
        <Globe className="w-3.5 h-3.5 text-blue-400" />
        <span className="font-mono font-bold">{currentCurrency}</span>
        <span className="text-slate-400 font-normal">({activeMeta?.symbol || currentCurrency})</span>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-white/10 bg-[#0d131f]/95 backdrop-blur-md shadow-2xl z-50 py-1 overflow-hidden focus:outline-none">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Display Currency
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto py-1 divide-y divide-white/5">
            {supportedCurrencies.map((curr) => {
              const isSelected = curr.code === currentCurrency;
              const rate = rates[curr.code];
              const isBase = curr.code === "INR";

              return (
                <button
                  key={curr.code}
                  type="button"
                  onClick={() => {
                    setCurrency(curr.code);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors ${
                    isSelected
                      ? "bg-blue-600/20 text-white font-semibold"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <div className="flex flex-col truncate">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">{curr.code}</span>
                      <span className="text-slate-400 text-[11px] truncate">{curr.name}</span>
                    </div>
                    {!isBase && rate ? (
                      <span className="text-[10px] text-slate-400 font-mono">
                        1 INR = {rate} {curr.code}
                      </span>
                    ) : isBase ? (
                      <span className="text-[10px] text-slate-400 font-mono">
                        Base Currency (1.0)
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-slate-400 font-mono">{curr.symbol}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                </button>
              );
            })}
          </div>

          {rateDate && (
            <div className="px-3 py-1.5 bg-black/40 border-t border-white/5 text-[10px] text-slate-400 font-mono flex items-center justify-between">
              <span>ECB / Market Date:</span>
              <span>{rateDate}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
