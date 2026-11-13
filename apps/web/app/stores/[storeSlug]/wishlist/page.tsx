"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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
import { useCart } from "../../../../src/context/cart-context";
import {
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
      <div className="at-container pb-24 pt-8 sm:pt-12">
        <div className="space-y-4 max-w-xl mb-8">
          <div className="h-8 w-48 bg-muted/60 rounded-none" />
          <div className="h-4 w-72 bg-muted/40 rounded-none" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[3/4] rounded-none bg-muted/40 border border-[color:var(--at-hairline)]" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <motion.main
        className="max-w-xl mx-auto px-4 py-20 sm:py-28 text-center space-y-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-none bg-primary/10 text-primary border border-primary/20">
          <Heart size={36} className="opacity-80" />
        </div>
        <div className="space-y-2">
          <h1 className="at-display-lg text-foreground">
            Your wishlist is empty
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Keep track of items you love by tapping the heart icon on any product in our store.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href={`/stores/${encodeURIComponent(storeSlug)}/products`}
            className="btn btn-primary btn-md rounded-full px-7 text-xs font-bold gap-2 hover:shadow-primary/25 active:scale-95 transition-all inline-flex items-center"
          >
            <span>Explore Products</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </motion.main>
    );
  }

  return (
    <div className="at-container pb-24 pt-8 sm:pt-12 space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[color:var(--at-hairline)]">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2">
            <Heart size={16} className="text-primary fill-primary" />
            <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
              Saved Favorites
            </span>
          </div>
          <h1 className="at-display-lg text-foreground">
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
          <Link
            href={`/stores/${encodeURIComponent(storeSlug)}/products`}
            className="btn btn-primary btn-sm rounded-full text-xs font-bold gap-1.5"
          >
            <span>Continue Shopping</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {/* Error alert if adding failed */}
      {actionError && (
        <div role="alert" className="p-4 rounded-none bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Wishlist Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {items.map((item, index) => {
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
            <motion.article
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1], delay: Math.min(index, 7) * 0.04 }}
              className="group relative flex flex-col rounded-none border border-[color:var(--at-hairline)] bg-transparent overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:border-foreground/25 transition-[box-shadow,border-color] duration-300"
            >
              {/* Media Thumbnail */}
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30">
                <Link href={productHref} className="block w-full h-full">
                  {item.primaryMediaUrl ? (
                    <img
                      src={item.primaryMediaUrl}
                      alt={item.productTitle}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-muted-foreground bg-muted/20">
                      <Package size={32} className="opacity-40 mb-1" />
                      <span className="text-[10px] uppercase tracking-wider opacity-60">
                        No image
                      </span>
                    </div>
                  )}
                </Link>

                {/* Stock status overlay */}
                <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
                  {item.isOutOfStock ? (
                    <Badge variant="warning" size="sm" className="font-semibold">
                      Out of Stock
                    </Badge>
                  ) : (
                    <Badge variant="success" size="sm" className="font-semibold">
                      In Stock
                    </Badge>
                  )}
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => void removeItemById(item.id)}
                  aria-label={`Remove ${item.productTitle} from wishlist`}
                  className="absolute top-2.5 right-2.5 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 hover:bg-destructive hover:text-white text-muted-foreground border border-[color:var(--at-hairline)] transition-colors cursor-pointer"
                  title="Remove from wishlist"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Product Info & Actions */}
              <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                <div className="space-y-1">
                  {item.variantTitle && (
                    <span className="text-[10px] uppercase text-muted-foreground tracking-wider block truncate">
                      {item.variantTitle}
                    </span>
                  )}
                  <h3 className="text-sm font-bold tracking-tight text-foreground line-clamp-1">
                    <Link href={productHref} className="hover:text-primary transition-colors">
                      {item.productTitle}
                    </Link>
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
                  className={`w-full py-2.5 px-3 rounded-none text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 ${
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
            </motion.article>
          );
        })}
      </div>
    </div>
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
        <StorefrontShell storeName={storeName} storeSlug={storeSlug} fullBleed>
          <WishlistContent storeSlug={storeSlug} storeName={storeName} />
        </StorefrontShell>
  );
}
