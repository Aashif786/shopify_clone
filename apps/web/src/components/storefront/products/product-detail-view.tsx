import React, { useState } from "react";
import type { ProductDetailDTO, ProductVariantDTO } from "@shopify-clone/products";
import { Badge, Card, CardContent, Spinner } from "@shopify-clone/ui";
import { formatStorePrice } from "./product-card";
import { useOptionalCart } from "../../../context/cart-context";
import {
  ShoppingBag,
  ShieldCheck,
  Truck,
  RotateCcw,
  Check,
  Sparkles,
} from "lucide-react";

export interface VariantInventoryDTO {
  availableQuantity: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  lowStockThreshold: number;
  maxOrderQuantity: number | null;
  effectiveMaxQuantity: number;
}

export type StorefrontVariantDTO = ProductVariantDTO & {
  inventory?: VariantInventoryDTO;
};

export type StorefrontProductDetailDTO = Omit<ProductDetailDTO, "variants"> & {
  variants: StorefrontVariantDTO[];
  inventory?: {
    isOutOfStock: boolean;
    isLowStock: boolean;
    totalAvailableQuantity: number;
  };
};

export interface ProductDetailViewProps {
  product: StorefrontProductDetailDTO;
  storeSlug: string;
  storeName: string;
  storeCurrency?: string;
  onAddToCart?: (variantId: string, quantity: number) => Promise<unknown>;
}

export function ProductDetailView({
  product,
  storeSlug,
  storeName,
  storeCurrency,
  onAddToCart,
}: ProductDetailViewProps) {
  const cartContext = useOptionalCart();

  // Active variants only
  const activeVariants = product.variants.filter((v) => v.status === "ACTIVE");
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    activeVariants[0]?.id || "",
  );
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [addSuccess, setAddSuccess] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);

  const selectedVariant: StorefrontVariantDTO | undefined =
    activeVariants.find((v) => v.id === selectedVariantId) || activeVariants[0];

  const selectedVariantInventory = selectedVariant?.inventory;
  const isOutOfStock =
    selectedVariantInventory?.isOutOfStock ??
    (selectedVariantInventory !== undefined
      ? selectedVariantInventory.availableQuantity <= 0
      : activeVariants.length === 0);
  const isLowStock = selectedVariantInventory?.isLowStock ?? false;
  const availableQuantity =
    selectedVariantInventory?.availableQuantity ??
    (isOutOfStock ? 0 : 999);
  const maxOrderQuantity =
    selectedVariantInventory?.maxOrderQuantity ??
    selectedVariant?.maxOrderQuantity ??
    product.maxOrderQuantity ??
    null;
  const effectiveMaxQuantity =
    selectedVariantInventory?.effectiveMaxQuantity ??
    Math.max(
      0,
      maxOrderQuantity !== null
        ? Math.min(availableQuantity, maxOrderQuantity)
        : availableQuantity,
    );

  const currency =
    selectedVariant?.currency || storeCurrency || "USD";
  const price = selectedVariant?.price;
  const compareAtPrice = selectedVariant?.compareAtPrice;
  const hasCompareAt =
    compareAtPrice !== null &&
    compareAtPrice !== undefined &&
    price !== undefined &&
    compareAtPrice > price;

  // Calculate discount percentage
  const discountPercent =
    hasCompareAt && compareAtPrice && price
      ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
      : null;

  // Determine if this product has selectable variants vs a single default variant
  const isDefaultSingleVariant =
    activeVariants.length <= 1 &&
    (activeVariants.length === 0 ||
      activeVariants[0]?.title === "Default Title" ||
      activeVariants[0]?.title === "Default");

  const currentMedia =
    product.media && product.media.length > 0
      ? product.media[selectedMediaIndex] || product.media[0]
      : undefined;

  const catalogHref = `/stores/${encodeURIComponent(storeSlug)}/products`;

  return (
    <div className="storefront-product-detail-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8" data-testid="product-detail-view">
      {/* 1. Navigation Breadcrumbs */}
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
          <li aria-current="page" className="storefront-breadcrumb-current text-foreground font-semibold truncate max-w-xs sm:max-w-md">
            {product.title}
          </li>
        </ol>
      </nav>

      {/* 2. Main Product Layout */}
      <div className="storefront-product-detail-layout grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
        {/* Left Column: Media Gallery (7 cols on lg) */}
        <div className="storefront-product-gallery lg:col-span-7 space-y-4">
          <div className="storefront-product-gallery-main card relative aspect-[4/4] sm:aspect-[4/3] lg:aspect-[4/4] w-full overflow-hidden rounded-3xl border border-border/60 bg-muted/20 shadow-sm">
            {currentMedia ? (
              <img
                src={currentMedia.url}
                alt={currentMedia.altText || product.title}
                className="storefront-gallery-main-image w-full h-full object-cover object-center transition-all duration-300"
                data-testid="main-product-image"
              />
            ) : (
              <div
                className="storefront-gallery-fallback w-full h-full flex flex-col items-center justify-center p-8 text-muted-foreground"
                role="img"
                aria-label={`No image available for ${product.title}`}
                data-testid="product-image-fallback"
              >
                <svg
                  className="storefront-gallery-fallback-icon w-16 h-16 stroke-1 opacity-30 mb-3"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-sm font-medium">No product image available</span>
              </div>
            )}

            {/* Savings Pill Overlay */}
            {discountPercent !== null && discountPercent > 0 && (
              <div className="absolute top-4 left-4 z-10">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-destructive text-destructive-foreground shadow-md">
                  SAVE {discountPercent}%
                </span>
              </div>
            )}
          </div>

          {/* Media Thumbnails */}
          {product.media && product.media.length > 1 && (
            <div
              className="storefront-gallery-thumbnails"
              role="tablist"
              aria-label="Product Media Thumbnails"
              style={{ display: "flex", alignItems: "center", gap: "0.75rem", overflowX: "auto", paddingBottom: "0.5rem" }}
            >
              {product.media.map((media, idx) => (
                <button
                  key={media.id || idx}
                  type="button"
                  role="tab"
                  aria-selected={idx === selectedMediaIndex}
                  className={`storefront-gallery-thumb-btn relative shrink-0 w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                    idx === selectedMediaIndex
                      ? "storefront-gallery-thumb-btn--active border-primary ring-2 ring-primary/20 scale-102"
                      : "border-border/60 opacity-70 hover:opacity-100"
                  }`}
                  onClick={() => setSelectedMediaIndex(idx)}
                >
                  <img
                    src={media.url}
                    alt={media.altText || `${product.title} view ${idx + 1}`}
                    className="storefront-gallery-thumb-img w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Product Purchase Info (5 cols on lg, sticky) */}
        <div className="storefront-product-info lg:col-span-5 lg:sticky lg:top-28">
          <Card className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-md shadow-sm">
            <CardContent className="p-6 sm:p-8 space-y-6">
              {/* Header: Title, SKU, Stock Status */}
              <div className="storefront-info-header space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {storeName}
                  </span>
                </div>

                <h1 className="storefront-product-title text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                  {product.title}
                </h1>

                <div className="storefront-status-row flex flex-wrap items-center gap-2.5 pt-1">
                  {isOutOfStock ? (
                    <Badge variant="warning" size="md" data-testid="stock-badge" className="font-semibold">
                      Out of Stock
                    </Badge>
                  ) : isLowStock ? (
                    <Badge variant="warning" size="md" data-testid="stock-badge" className="font-semibold">
                      Only {availableQuantity} left
                    </Badge>
                  ) : (
                    <Badge variant="success" size="md" data-testid="stock-badge" className="font-semibold">
                      In Stock
                    </Badge>
                  )}

                  {maxOrderQuantity !== null && (
                    <span className="text-muted-foreground text-xs storefront-limit-badge px-2 py-0.5 rounded-full bg-muted/60 border border-border/50" data-testid="max-order-limit">
                      Limit {maxOrderQuantity} per order
                    </span>
                  )}

                  {selectedVariant?.sku && (
                    <span className="storefront-sku text-xs text-muted-foreground font-mono" data-testid="product-sku">
                      SKU: {selectedVariant.sku}
                    </span>
                  )}
                </div>
              </div>

              {/* Price Section */}
              <div className="storefront-price-section flex items-baseline gap-3 py-3 border-y border-border/60" aria-label="Pricing">
                <span className="storefront-price-main text-3xl font-extrabold tracking-tight text-foreground" data-testid="product-price">
                  {formatStorePrice(price, currency)}
                </span>
                {hasCompareAt && (
                  <span
                    className="storefront-price-compare text-base font-medium text-muted-foreground line-through"
                    aria-label={`Was ${formatStorePrice(compareAtPrice, currency)}`}
                  >
                    {formatStorePrice(compareAtPrice, currency)}
                  </span>
                )}
              </div>

              {/* Variant Selector */}
              {!isDefaultSingleVariant && activeVariants.length > 1 && (
                <fieldset className="storefront-variant-picker space-y-2.5" data-testid="variant-selector">
                  <legend className="storefront-variant-picker-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Variants: <span className="text-foreground normal-case font-bold ml-1">{selectedVariant?.title}</span>
                  </legend>
                  <div
                    className="storefront-variant-options flex flex-wrap gap-2"
                    role="radiogroup"
                    aria-label="Product variants"
                  >
                    {activeVariants.map((variant) => {
                      const isSelected = variant.id === selectedVariant?.id;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          className={`btn ${
                            isSelected
                              ? "btn-primary shadow-sm ring-2 ring-primary/20"
                              : "btn-outline hover:border-primary/40 hover:bg-muted/50"
                          } btn-sm storefront-variant-btn rounded-xl px-3.5 py-2 text-xs font-semibold transition-all`}
                          onClick={() => setSelectedVariantId(variant.id)}
                          data-testid={`variant-btn-${variant.id}`}
                        >
                          {variant.title}
                          {variant.price !== undefined && variant.price !== price && (
                            <span className="storefront-variant-btn-price ml-1 opacity-80 font-normal">
                              ({formatStorePrice(variant.price, variant.currency || currency)})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {/* Single Variant Display Notice */}
              {isDefaultSingleVariant && activeVariants.length === 1 && (
                <div className="storefront-default-variant-note" data-testid="default-variant-badge">
                  <span className="text-muted-foreground text-xs font-medium">Standard option</span>
                </div>
              )}

              {/* Add to Cart Actions */}
              <div className="storefront-add-to-cart-container space-y-4 pt-2">
                {addSuccess && (
                  <div
                    className="alert alert--success storefront-cart-feedback p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center justify-between"
                    role="status"
                    data-testid="add-to-cart-success"
                  >
                    <span className="flex items-center gap-1.5">
                      <Check size={15} /> Added {quantity} {quantity === 1 ? "item" : "items"} to cart!
                    </span>
                    <a
                      href={`/stores/${encodeURIComponent(storeSlug)}/cart`}
                      onClick={(e) => {
                        if (cartContext?.openDrawer) {
                          e.preventDefault();
                          cartContext.openDrawer();
                        }
                      }}
                      className="btn btn-outline btn-xs rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer"
                      data-testid="open-cart-after-add"
                    >
                      View in Cart
                    </a>
                  </div>
                )}

                {addError && (
                  <div
                    className="alert alert--danger storefront-cart-feedback p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium"
                    role="alert"
                    data-testid="add-to-cart-error"
                  >
                    <span>{addError}</span>
                  </div>
                )}

                <div className="storefront-cart-actions-row flex items-center gap-3">
                  {/* Quantity Stepper */}
                  <div className="storefront-quantity-control">
                    <label htmlFor="product-qty-input" className="sr-only">
                      Quantity
                    </label>
                    <div className="cart-quantity-stepper flex items-center rounded-2xl border border-border/80 bg-background p-1 shadow-sm">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm cart-stepper-btn w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold hover:bg-muted"
                        onClick={() => {
                          setQuantity((q) => Math.max(1, q - 1));
                          setAddSuccess(false);
                        }}
                        disabled={isOutOfStock || quantity <= 1 || isAdding}
                        aria-label="Decrease quantity"
                        data-testid="decrease-quantity-btn"
                      >
                        -
                      </button>
                      <input
                        id="product-qty-input"
                        type="number"
                        min={isOutOfStock ? 0 : 1}
                        max={effectiveMaxQuantity}
                        value={isOutOfStock ? 0 : Math.min(quantity, effectiveMaxQuantity || 1)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            const clampMax = effectiveMaxQuantity > 0 ? effectiveMaxQuantity : 1;
                            setQuantity(Math.max(1, Math.min(clampMax, val)));
                          }
                          setAddSuccess(false);
                        }}
                        className="cart-quantity-input w-12 text-center bg-transparent text-sm font-semibold text-foreground focus:outline-none"
                        disabled={isOutOfStock || effectiveMaxQuantity <= 0 || isAdding}
                        aria-label="Product quantity"
                        data-testid="quantity-input"
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-sm cart-stepper-btn w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold hover:bg-muted"
                        onClick={() => {
                          setQuantity((q) => Math.min(effectiveMaxQuantity, q + 1));
                          setAddSuccess(false);
                        }}
                        disabled={
                          isOutOfStock ||
                          effectiveMaxQuantity <= 0 ||
                          quantity >= effectiveMaxQuantity ||
                          isAdding
                        }
                        aria-label="Increase quantity"
                        data-testid="increase-quantity-btn"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Add to Cart Button */}
                  <button
                    type="button"
                    className="btn btn-primary btn-md storefront-add-to-cart-btn flex-1 h-12 rounded-2xl text-sm font-bold gap-2 shadow-lg hover:shadow-primary/20 transition-all"
                    disabled={
                      !selectedVariant ||
                      activeVariants.length === 0 ||
                      isOutOfStock ||
                      effectiveMaxQuantity <= 0 ||
                      isAdding ||
                      cartContext?.isMutating
                    }
                    onClick={async () => {
                      if (
                        !selectedVariant ||
                        activeVariants.length === 0 ||
                        isOutOfStock ||
                        effectiveMaxQuantity <= 0
                      )
                        return;
                      const orderQty = Math.max(
                        1,
                        Math.min(effectiveMaxQuantity, quantity),
                      );
                      if (isAdding || cartContext?.isMutating) return;

                      setIsAdding(true);
                      setAddSuccess(false);
                      setAddError(null);

                      try {
                        if (onAddToCart) {
                          await onAddToCart(selectedVariant.id, orderQty);
                        } else if (cartContext) {
                          await cartContext.addItem(selectedVariant.id, orderQty);
                        }
                        setAddSuccess(true);
                      } catch (err: unknown) {
                        const msg =
                          err instanceof Error ? err.message : "Failed to add item to cart";
                        setAddError(msg);
                      } finally {
                        setIsAdding(false);
                      }
                    }}
                    data-testid="add-to-cart-button"
                  >
                    {isAdding ? (
                      <>
                        <Spinner size="sm" />
                        <span>Adding...</span>
                      </>
                    ) : isOutOfStock || effectiveMaxQuantity <= 0 ? (
                      "Out of Stock"
                    ) : (
                      <>
                        <ShoppingBag size={18} />
                        <span>Add to Cart</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Value Props Strip */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border/50 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Truck size={15} className="text-primary shrink-0" />
                  <span>Complimentary shipping over $75</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={15} className="text-primary shrink-0" />
                  <span>100% Genuine Guaranteed</span>
                </div>
                <div className="flex items-center gap-2">
                  <RotateCcw size={15} className="text-primary shrink-0" />
                  <span>30-Day Hassle-Free Returns</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-primary shrink-0" />
                  <span>Curated Small-Batch Pieces</span>
                </div>
              </div>

              {/* Long-form Description */}
              {product.description && (
                <div className="storefront-description-section pt-4 border-t border-border/50 space-y-2.5">
                  <h2 className="storefront-section-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Description
                  </h2>
                  <div className="storefront-description-content text-sm text-foreground/90 leading-relaxed space-y-2">
                    {product.description.split("\n\n").map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Back to Catalog Link */}
              <div className="storefront-back-action pt-2">
                <a
                  href={catalogHref}
                  className="btn btn-outline btn-md storefront-back-btn w-full rounded-2xl justify-center text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  ← Back to All Products
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
