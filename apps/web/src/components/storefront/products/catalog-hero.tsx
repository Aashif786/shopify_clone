"use client";

import React from "react";
import { Sparkles, Tag, CheckCircle2, ShieldCheck, Truck, RotateCcw } from "lucide-react";
import { Marquee } from "@/components/ui/marquee";
import { NumberTicker } from "@/components/ui/number-ticker";

export interface CatalogHeroProps {
  storeName: string;
  totalProducts: number;
  categories?: Array<{ id: string; name: string; slug: string }>;
  selectedCategory?: string;
  onSelectCategory?: (categoryId: string) => void;
  onSaleOnly?: boolean;
  onToggleSale?: (val: boolean) => void;
  inStockOnly?: boolean;
  onToggleInStock?: (val: boolean) => void;
}

export function CatalogHero({
  storeName,
  totalProducts,
  categories = [],
  selectedCategory = "",
  onSelectCategory,
  onSaleOnly = false,
  onToggleSale,
  inStockOnly = false,
  onToggleInStock,
}: CatalogHeroProps) {
  return (
    <section className="catalog-hero relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-primary/5 via-card/60 to-background p-6 sm:p-10 shadow-xs space-y-6">
      {/* Background Ambient Glow */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
        aria-hidden="true"
      />

      {/* Top Editorial Row */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-mono font-bold tracking-wider uppercase">
            <Sparkles size={12} className="animate-spin" style={{ animationDuration: "6s" }} />
            <span>Curated Collection</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.1]">
            Explore Products
          </h1>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
            Discover signature styles, limited seasonal drops, and essential accessories crafted by{" "}
            <span className="font-semibold text-foreground">{storeName}</span>.
          </p>
        </div>

        {/* Live Catalog Counter */}
        <div className="shrink-0 flex items-center gap-3">
          <div className="rounded-2xl border border-border/80 bg-background/80 backdrop-blur-md px-5 py-3 shadow-xs">
            <span className="text-[10px] font-mono font-semibold tracking-wider uppercase text-muted-foreground block">
              Available Items
            </span>
            <div className="flex items-baseline gap-1.5 pt-0.5">
              <span className="text-2xl font-black text-foreground font-mono">
                <NumberTicker value={totalProducts} />
              </span>
              <span className="text-xs text-muted-foreground font-medium">products</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Category & Highlight Filter Pills */}
      <div className="relative z-10 pt-2 border-t border-border/40">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {/* "All" Pill */}
          <button
            type="button"
            onClick={() => onSelectCategory?.("")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
              !selectedCategory && !onSaleOnly && !inStockOnly
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground border-border/80"
            }`}
          >
            All Items ({totalProducts})
          </button>

          {/* "On Sale" Pill */}
          <button
            type="button"
            onClick={() => onToggleSale?.(!onSaleOnly)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border inline-flex items-center gap-1.5 ${
              onSaleOnly
                ? "bg-destructive text-destructive-foreground border-destructive shadow-xs"
                : "bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground border-border/80"
            }`}
          >
            <Tag size={13} />
            <span>On Sale</span>
          </button>

          {/* "In Stock" Pill */}
          <button
            type="button"
            onClick={() => onToggleInStock?.(!inStockOnly)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border inline-flex items-center gap-1.5 ${
              inStockOnly
                ? "bg-emerald-500 text-white border-emerald-500 shadow-xs"
                : "bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground border-border/80"
            }`}
          >
            <CheckCircle2 size={13} />
            <span>In Stock Only</span>
          </button>

          {/* Dynamic Categories */}
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory?.(isSelected ? "" : cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground border-border/80"
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Assurance / Trust Perks Marquee */}
      <div className="relative z-10 pt-1 -mx-6 sm:-mx-10 -mb-6 sm:-mb-10 bg-muted/30 border-t border-border/40 py-2.5 overflow-hidden">
        <Marquee pauseOnHover className="[--duration:32s] [--gap:2.5rem] py-0">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-foreground/80 px-2">
            <Truck size={14} className="text-primary" />
            <span>Complimentary Express Delivery on orders over $75</span>
          </div>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-foreground/80 px-2">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>100% Verified Authentic Merchandise</span>
          </div>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-foreground/80 px-2">
            <RotateCcw size={14} className="text-primary" />
            <span>Effortless 30-Day In-Store & Online Returns</span>
          </div>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-foreground/80 px-2">
            <Sparkles size={14} className="text-amber-500" />
            <span>Real-Time Concurrency-Safe Stock Reservation</span>
          </div>
        </Marquee>
      </div>
    </section>
  );
}
