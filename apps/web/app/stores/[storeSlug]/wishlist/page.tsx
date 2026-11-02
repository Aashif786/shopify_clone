"use client";

import React, { use, useState, useEffect } from "react";
import {
  Heart,
  ShoppingBag,
  Trash2,
  ArrowRight,
  Package,
  Check,
  AlertCircle,
} from "lucide-react";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { CartProvider, useCart } from "../../../../src/context/cart-context";
import {
  WishlistProvider,
  useWishlist,
  type WishlistItemDTO,
} from "../../../../src/context/wishlist-context";
import { formatStorePrice } from "../../../../src/components/storefront/products/product-card";
import { apiClient } from "../../../../src/lib/api-client";
import { Badge } from "@calcart/ui";

interface StorefrontWishlistPageProps {
  params: Promise<{ storeSlug: string }>;
}

function WishlistContent({ storeSlug, storeName }: { storeSlug: string; storeName: string }) {
  const { items, itemCount, isLoading, removeItemById, clearWishlist } = useWishlist();
  const cartContext = useCart();
  const [addingItemId, setAddingItemId] = useState<string | null>(null);
  const [addedItemIds, setAddedItemIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAddToCart = async (item: WishlistItemDTO) => {
    setActionError(null);
    setAddingItemId(item.id);

    try {
      if (item.variantId) {
        await cartContext.addItem(item.variantId, 1);
      } else {
        // Resolve first active variant if item only had productId
        const productRes = await apiClient.get<{
          product: { variants: Array<{ id: string; status: string }> };
        }>(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(item.productSlug)}`);

        const firstVariant = productRes?.product?.variants?.find((v) => v.status === "ACTIVE") || productRes?.product?.variants?.[0];
        if (firstVariant) {
          await cartContext.addItem(firstVariant.id, 1);
        } else {
          throw new Error("No available variant found for this item");
        }
      }

      setAddedItemIds((prev) => new Set([...prev, item.id]));
      cartContext.openDrawer();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add item to cart");
    } finally {
      setAddingItemId(null);
    }
  };

  if (isLoading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="space-y-4 max-w-xl mb-8">
          <div className="h-8 w-48 bg-muted/60 animate-pulse rounded-xl" />
          <div className="h-4 w-72 bg-muted/40 animate-pulse rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
          ))}
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="max-w-xl mx-auto px-4 py-20 sm:py-28 text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/5">
          <Heart size={36} className="opacity-80" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Your wishlist is empty
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Keep track of items you love by tapping the heart icon on any product in our store.
          </p>
        </div>
        <div className="pt-2">
          <a
            href={`/stores/${encodeURIComponent(storeSlug)}/products`}
            className="btn btn-primary btn-md rounded-full px-7 text-xs font-bold gap-2 shadow-lg shadow-primary/15 hover:shadow-primary/25 active:scale-95 transition-all inline-flex items-center"
          >
            <span>Explore Products</span>
            <ArrowRight size={14} />
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border/60">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2">
            <Heart size={16} className="text-primary fill-primary" />
            <span className="text-[11px] font-mono font-semibold tracking-wider uppercase text-muted-foreground">
              Saved Favorites
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Customer Wishlist
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {itemCount} {itemCount === 1 ? "item" : "items"} saved in {storeName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void clearWishlist()}
            className="btn btn-outline btn-sm rounded-full text-xs font-semibold gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Clear Wishlist</span>
          </button>
          <a
            href={`/stores/${encodeURIComponent(storeSlug)}/products`}
            className="btn btn-primary btn-sm rounded-full text-xs font-bold gap-1.5 shadow-xs"
          >
            <span>Continue Shopping</span>
            <ArrowRight size={13} />
          </a>
        </div>
      </header>

      {/* Error alert if adding failed */}
      {actionError && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Wishlist Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {items.map((item) => {
          const productHref = `/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(item.productSlug)}${
            item.variantId ? `?variant=${encodeURIComponent(item.variantId)}` : ""
          }`;
          const isAdding = addingItemId === item.id;
          const isAdded = addedItemIds.has(item.id);
          const hasPrice = item.price !== null && item.price !== undefined;
          const hasCompare =
            item.compareAtPrice !== null &&
            item.compareAtPrice !== undefined &&
            hasPrice &&
            item.compareAtPrice > (item.price ?? 0);

          return (
            <article
              key={item.id}
              className="group relative flex flex-col rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xs overflow-hidden shadow-xs hover:shadow-xl hover:shadow-primary/5 hover:border-foreground/25 transition-all duration-300"
            >
              {/* Media Thumbnail */}
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30">
                <a href={productHref} className="block w-full h-full">
                  {item.primaryMediaUrl ? (
                    <img
                      src={item.primaryMediaUrl}
                      alt={item.productTitle}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-muted-foreground bg-muted/20">
                      <Package size={32} className="opacity-40 mb-1" />
                      <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">
                        No image
                      </span>
                    </div>
                  )}
                </a>

                {/* Stock status overlay */}
                <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
                  {item.isOutOfStock ? (
                    <Badge variant="warning" size="sm" className="font-semibold shadow-xs backdrop-blur-md">
                      Out of Stock
                    </Badge>
                  ) : (
                    <Badge variant="success" size="sm" className="font-semibold shadow-xs backdrop-blur-md">
                      In Stock
                    </Badge>
                  )}
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => void removeItemById(item.id)}
                  aria-label={`Remove ${item.productTitle} from wishlist`}
                  className="absolute top-2.5 right-2.5 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 hover:bg-destructive hover:text-white text-muted-foreground backdrop-blur-md border border-border/40 shadow-xs transition-colors cursor-pointer"
                  title="Remove from wishlist"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Product Info & Actions */}
              <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                <div className="space-y-1">
                  {item.variantTitle && (
                    <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block truncate">
                      {item.variantTitle}
                    </span>
                  )}
                  <h3 className="text-sm font-bold tracking-tight text-foreground line-clamp-1">
                    <a href={productHref} className="hover:text-primary transition-colors">
                      {item.productTitle}
                    </a>
                  </h3>
                  <div className="flex items-baseline gap-2 pt-1">
                    {hasPrice ? (
                      <>
                        <span className="text-sm font-extrabold text-foreground">
                          {formatStorePrice(item.price, item.currency)}
                        </span>
                        {hasCompare && (
                          <span className="text-xs text-muted-foreground line-through font-medium">
                            {formatStorePrice(item.compareAtPrice, item.currency)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Price unavailable</span>
                    )}
                  </div>
                </div>

                {/* Add to Cart CTA */}
                <button
                  type="button"
                  onClick={() => handleAddToCart(item)}
                  disabled={item.isOutOfStock || isAdding}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98 ${
                    item.isOutOfStock
                      ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                      : isAdded
                      ? "bg-emerald-600 text-white"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {isAdding ? (
                    <span>Adding to Cart...</span>
                  ) : isAdded ? (
                    <>
                      <Check size={14} />
                      <span>Added to Cart</span>
                    </>
                  ) : item.isOutOfStock ? (
                    <span>Out of Stock</span>
                  ) : (
                    <>
                      <ShoppingBag size={14} />
                      <span>Move to Cart</span>
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}

export default function StorefrontWishlistPage({ params }: StorefrontWishlistPageProps) {
  const { storeSlug } = use(params);
  const [storeName, setStoreName] = useState<string>("Store");

  useEffect(() => {
    async function loadStore() {
      try {
        const res = await apiClient.get<{ store: { name: string } }>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/landing-page`,
        );
        if (res?.store?.name) {
          setStoreName(res.store.name);
        }
      } catch {
        // Fallback
      }
    }
    void loadStore();
  }, [storeSlug]);

  return (
    <CartProvider storeSlug={storeSlug}>
      <WishlistProvider storeSlug={storeSlug}>
        <StorefrontShell storeName={storeName} storeSlug={storeSlug}>
          <WishlistContent storeSlug={storeSlug} storeName={storeName} />
        </StorefrontShell>
      </WishlistProvider>
    </CartProvider>
  );
}
