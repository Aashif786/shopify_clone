"use client";

import React, { use, useEffect, useState } from "react";
import { CartProvider, useCart } from "../../../../src/context/cart-context";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { CartItems } from "../../../../src/components/storefront/cart/cart-items";
import { CartSummary } from "../../../../src/components/storefront/cart/cart-summary";
import { apiClient } from "../../../../src/lib/api-client";
import { Alert, Button, Spinner } from "@shopify-clone/ui";

interface CartPageProps {
  params: Promise<{ storeSlug: string }>;
}

function CartView({ storeSlug, storeName }: { storeSlug: string; storeName: string }) {
  const { cart, isLoading, error, refreshCart } = useCart();
  const catalogHref = `/stores/${encodeURIComponent(storeSlug)}/products`;

  return (
    <StorefrontShell storeName={storeName} storeSlug={storeSlug}>
      <div className="storefront-cart-page-container" data-testid="storefront-cart-page">
        {/* Breadcrumbs */}
        <nav className="storefront-breadcrumbs" aria-label="Breadcrumb">
          <ol className="storefront-breadcrumb-list">
            <li>
              <a href={`/stores/${encodeURIComponent(storeSlug)}`} className="storefront-breadcrumb-link">
                {storeName}
              </a>
            </li>
            <li aria-hidden="true" className="storefront-breadcrumb-sep">/</li>
            <li>
              <a href={catalogHref} className="storefront-breadcrumb-link">
                Products
              </a>
            </li>
            <li aria-hidden="true" className="storefront-breadcrumb-sep">/</li>
            <li aria-current="page" className="storefront-breadcrumb-current">
              Shopping Cart
            </li>
          </ol>
        </nav>

        {/* Page Header */}
        <div className="storefront-page-header">
          <h1 className="storefront-page-title">Shopping Cart</h1>
          {cart && cart.items.length > 0 && (
            <p className="storefront-page-subtitle">
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
          <div className="storefront-grid-state storefront-grid-loading" data-testid="cart-loading">
            <Spinner size="lg" />
            <p className="storefront-grid-loading-text">Loading cart items...</p>
          </div>
        ) : !cart || cart.items.length === 0 ? (
          /* Empty Cart State */
          <div className="storefront-cart-empty-state card" data-testid="cart-empty-view">
            <div className="storefront-cart-empty-icon checkout-glyph" aria-hidden="true">
              CART
            </div>
            <h2 className="storefront-cart-empty-title">Your shopping cart is empty</h2>
            <p className="storefront-cart-empty-desc text-muted">
              You haven&apos;t added any items to your cart yet. Discover quality products in our store.
            </p>
            <div style={{ marginTop: "var(--space-6)" }}>
              <a href={catalogHref} className="btn btn-primary btn-md">
                Browse Products
              </a>
            </div>
          </div>
        ) : (
          /* Cart Content Layout: Two Columns */
          <div className="storefront-cart-layout">
            <div className="storefront-cart-items-column">
              <CartItems
                items={cart.items}
                storeSlug={storeSlug}
                currency={cart.currency}
              />
            </div>

            <div className="storefront-cart-summary-column">
              <CartSummary
                cart={cart}
                storeSlug={storeSlug}
                showCheckoutNotice={true}
                checkoutEnabled={true}
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
  const [storeName, setStoreName] = useState<string>("Online Store");

  // Fetch store details to get official store name
  useEffect(() => {
    let active = true;
    apiClient
      .get<{ store: { name: string } }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/cart`,
      )
      .then((data) => {
        if (active && data?.store?.name) {
          setStoreName(data.store.name);
        }
      })
      .catch(() => {
        // Fall back to formatted slug
        if (active) {
          setStoreName(storeSlug.charAt(0).toUpperCase() + storeSlug.slice(1));
        }
      });

    return () => {
      active = false;
    };
  }, [storeSlug]);

  return (
    <CartProvider storeSlug={storeSlug}>
      <CartView storeSlug={storeSlug} storeName={storeName} />
    </CartProvider>
  );
}
