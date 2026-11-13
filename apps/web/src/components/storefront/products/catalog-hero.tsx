"use client";

import React from "react";

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

const tab =
  "at-press relative inline-flex h-11 shrink-0 items-center whitespace-nowrap text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary aria-pressed:text-foreground aria-pressed:after:absolute aria-pressed:after:inset-x-0 aria-pressed:after:bottom-0 aria-pressed:after:h-px aria-pressed:after:bg-foreground";

/**
 * Catalogue masthead: an oversized serif title with a live count, then quick
 * filters as a quiet text tab row (underline = active). No cards, no gradients.
 */
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
  const allActive = !selectedCategory && !onSaleOnly && !inStockOnly;

  return (
    <section className="catalog-hero" aria-labelledby="catalog-title">
      <div className="flex flex-col gap-6 pb-8 pt-4 sm:pb-12 sm:pt-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="at-eyebrow text-muted-foreground">{storeName}</p>
          <h1 id="catalog-title" className="at-display-xl mt-3 text-foreground">
            All products
          </h1>
        </div>
        <p className="at-num text-sm text-muted-foreground" aria-live="polite">
          <span className="text-foreground">{totalProducts}</span>{" "}
          {totalProducts === 1 ? "piece" : "pieces"} shown
        </p>
      </div>

      <div
        className="-mx-[var(--at-gutter)] overflow-x-auto border-y border-[color:var(--at-hairline)] px-[var(--at-gutter)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="toolbar"
        aria-label="Quick filters"
      >
        <div className="flex items-center gap-7">
          <button
            type="button"
            className={tab}
            aria-pressed={allActive}
            onClick={() => {
              onSelectCategory?.("");
              onToggleSale?.(false);
              onToggleInStock?.(false);
            }}
          >
            All
          </button>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={tab}
                aria-pressed={isSelected}
                onClick={() => onSelectCategory?.(isSelected ? "" : cat.id)}
              >
                {cat.name}
              </button>
            );
          })}
          <span className="h-4 w-px shrink-0 bg-[color:var(--at-hairline)]" aria-hidden="true" />
          <button
            type="button"
            className={tab}
            aria-pressed={onSaleOnly}
            onClick={() => onToggleSale?.(!onSaleOnly)}
          >
            On sale
          </button>
          <button
            type="button"
            className={tab}
            aria-pressed={inStockOnly}
            onClick={() => onToggleInStock?.(!inStockOnly)}
          >
            In stock
          </button>
        </div>
      </div>
    </section>
  );
}
