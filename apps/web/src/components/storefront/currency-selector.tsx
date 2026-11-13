"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useCurrency } from "../../context/currency-context";

export function CurrencySelector() {
  const { currentCurrency, currencies, setCurrency, isLoading } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
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

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!currencies || currencies.length <= 1) {
    return null;
  }

  const currentMeta = currencies.find((c) => c.currency === currentCurrency);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-border/60 bg-background/80 hover:bg-muted/60 text-foreground transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.97]"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select currency, current currency: ${currentCurrency}`}
        disabled={isLoading}
      >
        <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="font-mono tracking-tight font-bold">{currentCurrency}</span>
        <span className="text-muted-foreground font-normal">
          ({currentMeta?.symbol || currentCurrency})
        </span>
        <ChevronDown
          className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="absolute right-0 mt-1.5 w-52 rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md shadow-lg shadow-black/5 z-50 py-1 overflow-hidden focus:outline-none"
            role="listbox"
          >
            <div className="px-3 py-1.5 border-b border-border/50 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              Select Currency
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {currencies
                .filter((c) => c.isEnabled)
                .map((item) => {
                  const isSelected = item.currency === currentCurrency;
                  return (
                    <button
                      key={item.currency}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setCurrency(item.currency);
                        setIsOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors ${
                        isSelected
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-foreground hover:bg-muted/70 font-medium"
                      } active:bg-muted`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono font-bold w-9 text-xs">
                          {item.currency}
                        </span>
                        <span className="text-muted-foreground truncate">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-muted-foreground text-xs font-semibold">
                          {item.symbol}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                    </button>
                  );
                })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
