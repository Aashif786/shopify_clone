"use client";

import React, { use } from "react";
import { CartProvider, useCart } from "../../../../src/context/cart-context";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { CartItems } from "../../../../src/components/storefront/cart/cart-items";
import { CartSummary } from "../../../../src/components/storefront/cart/cart-summary";
import { Alert, Button, Spinner } from "@shopify-clone/ui";
import { ShoppingBag, Truck, ArrowRight } from "lucide-react";

interface CartPageProps {
  params: Promise<{ storeSlug: string }>;
}

function CartView({ storeSlug, storeName }: { storeSlug: string; storeName: string }) {
  const { cart, isLoading, error, refreshCart } = useCart();
  const catalogHref = `/stores/${encodeURIComponent(storeSlug)}/products`;

  // Free shipping threshold ($75.00 / 7500 cents)
  const FREE_SHIPPING_THRESHOLD = 7500;
  const subtotal = cart?.subtotal ?? 0;
  const amountNeeded = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const freeShippingProgress = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));

  return (
    <StorefrontShell storeName={storeName} storeSlug={storeSlug}>
      <div className="storefront-cart-page-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8" data-testid="storefront-cart-page">
        {/* Breadcrumbs */}
        <nav className="storefront-breadcrumbs flex items-center text-xs font-medium text-muted-foreground" aria-label="Breadcrumb">
          <ol className="storefront-breadcrumb-list flex items-center gap-1.5 flex-wrap list-none p-0 m-0">
            <li>
              <a href={`/stores/${encodeURIComponent(storeSlug)}`} className="storefront-breadcrumb-link hover:text-foreground transition-colors">
                {storeName}
              </a>
            </li>
            <li aria-hidden="true" className="storefront-breadcrumb-sep text-border">/</li>
            <li>
              <a href={catalogHref} className="storefront-breadcrumb-link hover:text-foreground transition-colors">
                Products
              </a>
            </li>
            <li aria-hidden="true" className="storefront-breadcrumb-sep text-border">/</li>
            <li aria-current="page" className="storefront-breadcrumb-current text-foreground font-semibold">
              Shopping Cart
            </li>
          </ol>
        </nav>

        {/* Page Header */}
        <div className="storefront-page-header space-y-1">
          <h1 className="storefront-page-title text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Shopping Cart
          </h1>
          {cart && cart.items.length > 0 && (
            <p className="storefront-page-subtitle text-sm text-muted-foreground">
              Review your items and proceed when ready.
            </p>
          )}
        </div>

        {/* Global Error Banner */}
        {error && (
          <div style={{ marginBottom: "var(--space-6)" }}>
            <Alert
              variant="danger"
              title="Cart Error"
              action={
                <Button variant="outline" size="sm" onClick={() => refreshCart()}>
                  Retry
                </Button>
              }
            >
              {error.message || "Failed to load authoritative cart state"}
            </Alert>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !cart ? (
          <div className="storefront-grid-state storefront-grid-loading py-24 flex flex-col items-center justify-center text-center space-y-4" data-testid="cart-loading">
            <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm">
              <Spinner size="lg" className="spinner spinner-lg text-primary" />
            </div>
            <p className="storefront-grid-loading-text text-sm font-medium text-muted-foreground animate-pulse">
              Loading cart items...
            </p>
          </div>
        ) : !cart || cart.items.length === 0 ? (
          /* Empty Cart State */
          <div className="storefront-cart-empty-state card max-w-lg mx-auto py-16 px-6 text-center rounded-3xl border border-dashed border-border/80 bg-card/60 shadow-sm space-y-6" data-testid="cart-empty-view">
            <div className="storefront-cart-empty-icon checkout-glyph w-20 h-20 mx-auto rounded-3xl bg-muted/60 flex items-center justify-center text-muted-foreground" aria-hidden="true">
              <ShoppingBag size={36} className="opacity-60" />
            </div>
            <div className="space-y-2">
              <h2 className="storefront-cart-empty-title text-2xl font-extrabold tracking-tight text-foreground">
                Your shopping cart is empty
              </h2>
              <p className="storefront-cart-empty-desc text-muted text-sm text-muted-foreground max-w-sm mx-auto">
                You haven&apos;t added any items to your cart yet. Discover quality products in our store.
              </p>
            </div>
            <div className="pt-2">
              <a
                href={catalogHref}
                className="btn btn-primary btn-md rounded-2xl px-8 py-3 text-sm font-bold shadow-md hover:shadow-primary/20 transition-all inline-flex items-center gap-2"
              >
                <span>Browse Products</span>
                <ArrowRight size={16} />
              </a>
            </div>
          </div>
        ) : (
          /* Cart Content Layout: Two Columns */
          <div className="storefront-cart-layout grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column: Cart Items (8 cols on lg) */}
            <div className="storefront-cart-items-column lg:col-span-8 space-y-6">
              {/* Free Shipping Progress Card */}
              <div className="p-4 sm:p-5 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-1.5 text-foreground">
                    <Truck size={15} className="text-primary" />
                    <span>
                      {amountNeeded === 0
                        ? "You've unlocked Complimentary Express Shipping!"
                        : `Add $${(amountNeeded / 100).toFixed(2)} more for Free Shipping`}
                    </span>
                  </div>
                  <span className="text-muted-foreground">{freeShippingProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500 rounded-full"
                    style={{ width: `${freeShippingProgress}%` }}
                  />
                </div>
              </div>

              {/* Items Card */}
              <div className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8 shadow-sm">
                <CartItems
                  items={cart.items}
                  storeSlug={storeSlug}
                  currency={cart.currency}
                />
              </div>
            </div>

            {/* Right Column: Order Summary (4 cols on lg, sticky) */}
            <div className="storefront-cart-summary-column lg:col-span-4 lg:sticky lg:top-28">
              <CartSummary
                cart={cart}
                storeSlug={storeSlug}
                checkoutEnabled={true}
                showCheckoutNotice={true}
              />
            </div>
          </div>
        )}
      </div>
    </StorefrontShell>
  );
}

export default function StorefrontCartPage({ params }: CartPageProps) {
  const { storeSlug } = use(params);
  const formattedStoreName = storeSlug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <CartProvider storeSlug={storeSlug}>
      <CartView storeSlug={storeSlug} storeName={formattedStoreName} />
    </CartProvider>
  );
}
