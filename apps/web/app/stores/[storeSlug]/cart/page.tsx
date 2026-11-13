"use client";

import Link from "next/link";
import React, { use } from "react";
import { useCart } from "../../../../src/context/cart-context";
import { useOptionalStorefrontIdentity } from "../../../../src/components/storefront/storefront-providers";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { CartItems } from "../../../../src/components/storefront/cart/cart-items";
import { CartSummary } from "../../../../src/components/storefront/cart/cart-summary";
import { Alert, Button } from "@calcart/ui";
import { ArrowRight } from "lucide-react";

interface CartPageProps {
  params: Promise<{ storeSlug: string }>;
}

function CartView({ storeSlug, storeName }: { storeSlug: string; storeName: string }) {
  const { cart, isLoading, error, refreshCart } = useCart();
  const catalogHref = `/stores/${encodeURIComponent(storeSlug)}/products`;
  const identity = useOptionalStorefrontIdentity();
  const displayName = identity?.isLoaded && identity.storeName ? identity.storeName : storeName;


  return (
    <StorefrontShell storeName={displayName} storeSlug={storeSlug} fullBleed>
      <div className="storefront-cart-page-container at-container pb-24 pt-8 sm:pt-12" data-testid="storefront-cart-page">
        <nav className="storefront-breadcrumbs text-xs text-muted-foreground" aria-label="Breadcrumb">
          <ol className="storefront-breadcrumb-list m-0 flex list-none flex-wrap items-center gap-2 p-0">
            <li>
              <Link href={`/stores/${encodeURIComponent(storeSlug)}`} className="storefront-breadcrumb-link at-link">
                {displayName}
              </Link>
            </li>
            <li aria-hidden="true" className="storefront-breadcrumb-sep">/</li>
            <li aria-current="page" className="storefront-breadcrumb-current text-foreground">
              Cart
            </li>
          </ol>
        </nav>

        <div className="storefront-page-header flex items-end justify-between gap-6 pb-8 pt-6 sm:pb-12">
          <h1 className="storefront-page-title at-display-xl text-foreground">Shopping Cart</h1>
          {cart && cart.items.length > 0 && (
            <p className="storefront-page-subtitle at-num pb-2 text-sm text-muted-foreground">
              {cart.items.length} {cart.items.length === 1 ? "line" : "lines"}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-8">
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

        {isLoading && !cart ? (
          <div className="storefront-grid-state storefront-grid-loading border-t border-[color:var(--at-hairline)]" data-testid="cart-loading" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-5 border-b border-[color:var(--at-hairline)] py-6" aria-hidden="true">
                <div className="at-skeleton aspect-[4/5] w-24" />
                <div className="flex-1 space-y-3">
                  <div className="at-skeleton h-5 w-2/3" />
                  <div className="at-skeleton h-3 w-1/4" />
                </div>
              </div>
            ))}
            <p className="sr-only">Loading cart items...</p>
          </div>
        ) : !cart || cart.items.length === 0 ? (
          <div className="storefront-cart-empty-state border-y border-[color:var(--at-hairline)] py-20 text-center" data-testid="cart-empty-view">
            <h2 className="storefront-cart-empty-title at-display-md text-foreground">Your shopping cart is empty</h2>
            <p className="storefront-cart-empty-desc at-lede mx-auto mt-4 max-w-sm text-muted-foreground">
              You haven&apos;t added any items to your cart yet.
            </p>
            <Link
              href={catalogHref}
              className="at-press mt-8 inline-flex h-12 items-center gap-3 bg-primary px-8 text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground"
            >
              <span>Browse Products</span>
              <ArrowRight size={15} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="storefront-cart-layout grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="storefront-cart-items-column border-t border-[color:var(--at-hairline)] lg:col-span-7">
              <CartItems items={cart.items} storeSlug={storeSlug} currency={cart.currency} />
            </div>
            <div className="storefront-cart-summary-column lg:sticky lg:top-28 lg:col-span-5">
              <CartSummary cart={cart} storeSlug={storeSlug} checkoutEnabled={true} showCheckoutNotice={true} />
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
      <CartView storeSlug={storeSlug} storeName={formattedStoreName} />
  );
}
