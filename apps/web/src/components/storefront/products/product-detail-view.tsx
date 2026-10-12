import React, { useState } from "react";
import type { ProductDetailDTO, ProductVariantDTO } from "@shopify-clone/products";
import { Badge, Card, CardContent, Spinner } from "@shopify-clone/ui";
import { formatStorePrice } from "./product-card";
import { useOptionalCart } from "../../../context/cart-context";

export interface ProductDetailViewProps {
  product: ProductDetailDTO;
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

  const selectedVariant: ProductVariantDTO | undefined =
    activeVariants.find((v) => v.id === selectedVariantId) || activeVariants[0];

  const currency =
    selectedVariant?.currency || storeCurrency || "USD";
  const price = selectedVariant?.price;
  const compareAtPrice = selectedVariant?.compareAtPrice;
  const hasCompareAt =
    compareAtPrice !== null &&
    compareAtPrice !== undefined &&
    price !== undefined &&
    compareAtPrice > price;

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
    <div className="storefront-product-detail-container" data-testid="product-detail-view">
      {/* Navigation Breadcrumbs */}
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
            {product.title}
          </li>
        </ol>
      </nav>

      {/* Main Product Layout */}
      <div className="storefront-product-detail-layout">
        {/* Left Column: Media Gallery */}
        <div className="storefront-product-gallery">
          <div className="storefront-product-gallery-main card">
            {currentMedia ? (
              <img
                src={currentMedia.url}
                alt={currentMedia.altText || product.title}
                className="storefront-gallery-main-image"
                data-testid="main-product-image"
              />
            ) : (
              <div
                className="storefront-gallery-fallback"
                role="img"
                aria-label={`No image available for ${product.title}`}
                data-testid="product-image-fallback"
              >
                <svg
                  className="storefront-gallery-fallback-icon"
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
                <span>No product image available</span>
              </div>
            )}
          </div>

          {/* Media Thumbnails */}
          {product.media && product.media.length > 1 && (
            <div
              className="storefront-gallery-thumbnails"
              role="tablist"
              aria-label="Product Media Thumbnails"
            >
              {product.media.map((media, idx) => (
                <button
                  key={media.id || idx}
                  type="button"
                  role="tab"
                  aria-selected={idx === selectedMediaIndex}
                  className={`storefront-gallery-thumb-btn ${
                    idx === selectedMediaIndex ? "storefront-gallery-thumb-btn--active" : ""
                  }`}
                  onClick={() => setSelectedMediaIndex(idx)}
                >
                  <img
                    src={media.url}
                    alt={media.altText || `${product.title} view ${idx + 1}`}
                    className="storefront-gallery-thumb-img"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Product Info & Variant Selector */}
        <div className="storefront-product-info">
          <Card>
            <CardContent>
              <div className="storefront-info-header">
                <h1 className="storefront-product-title">{product.title}</h1>
                <div className="storefront-status-row">
                  {activeVariants.length > 0 ? (
                    <Badge variant="success" size="md">
                      In Stock
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="md">
                      Out of Stock
                    </Badge>
                  )}
                  {selectedVariant?.sku && (
                    <span className="storefront-sku" data-testid="product-sku">
                      SKU: {selectedVariant.sku}
                    </span>
                  )}
                </div>
              </div>

              {/* Price display */}
              <div className="storefront-price-section" aria-label="Pricing">
                <span className="storefront-price-main" data-testid="product-price">
                  {formatStorePrice(price, currency)}
                </span>
                {hasCompareAt && (
                  <span
                    className="storefront-price-compare"
                    aria-label={`Was ${formatStorePrice(compareAtPrice, currency)}`}
                  >
                    {formatStorePrice(compareAtPrice, currency)}
                  </span>
                )}
              </div>

              {/* Variant Selector */}
              {!isDefaultSingleVariant && activeVariants.length > 1 && (
                <fieldset className="storefront-variant-picker" data-testid="variant-selector">
                  <legend className="storefront-variant-picker-label">
                    Variants: <span className="font-semibold">{selectedVariant?.title}</span>
                  </legend>
                  <div
                    className="storefront-variant-options"
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
                          className={`btn ${isSelected ? "btn-primary" : "btn-outline"} btn-sm storefront-variant-btn`}
                          onClick={() => setSelectedVariantId(variant.id)}
                          data-testid={`variant-btn-${variant.id}`}
                        >
                          {variant.title}
                          {variant.price !== undefined && variant.price !== price && (
                            <span className="storefront-variant-btn-price">
                              {" "}({formatStorePrice(variant.price, variant.currency || currency)})
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
                  <span className="text-muted text-sm">Standard option</span>
                </div>
              )}

              {/* Add to Cart Section */}
              <div className="storefront-add-to-cart-container" style={{ marginTop: "var(--space-6)" }}>
                {addSuccess && (
                  <div
                    className="alert alert--success storefront-cart-feedback"
                    role="status"
                    data-testid="add-to-cart-success"
                    style={{ marginBottom: "var(--space-4)" }}
                  >
                    <span>✓ Added {quantity} {quantity === 1 ? "item" : "items"} to cart!</span>
                    {cartContext && (
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => cartContext.openDrawer()}
                        data-testid="open-cart-after-add"
                        style={{ marginLeft: "var(--space-3)" }}
                      >
                        View in Cart
                      </button>
                    )}
                  </div>
                )}

                {addError && (
                  <div
                    className="alert alert--danger storefront-cart-feedback"
                    role="alert"
                    data-testid="add-to-cart-error"
                    style={{ marginBottom: "var(--space-4)" }}
                  >
                    <span>{addError}</span>
                  </div>
                )}

                <div className="storefront-cart-actions-row">
                  {/* Quantity Stepper */}
                  <div className="storefront-quantity-control">
                    <label htmlFor="product-qty-input" className="sr-only">
                      Quantity
                    </label>
                    <div className="cart-quantity-stepper">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm cart-stepper-btn"
                        onClick={() => {
                          setQuantity((q) => Math.max(1, q - 1));
                          setAddSuccess(false);
                        }}
                        disabled={quantity <= 1 || isAdding}
                        aria-label="Decrease quantity"
                        data-testid="decrease-quantity-btn"
                      >
                        -
                      </button>
                      <input
                        id="product-qty-input"
                        type="number"
                        min={1}
                        max={999}
                        value={quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            setQuantity(Math.max(1, Math.min(999, val)));
                          }
                          setAddSuccess(false);
                        }}
                        className="cart-quantity-input"
                        disabled={isAdding}
                        aria-label="Product quantity"
                        data-testid="quantity-input"
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-sm cart-stepper-btn"
                        onClick={() => {
                          setQuantity((q) => Math.min(999, q + 1));
                          setAddSuccess(false);
                        }}
                        disabled={quantity >= 999 || isAdding}
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
                    className="btn btn-primary btn-md storefront-add-to-cart-btn"
                    disabled={
                      !selectedVariant ||
                      activeVariants.length === 0 ||
                      isAdding ||
                      cartContext?.isMutating
                    }
                    onClick={async () => {
                      if (!selectedVariant || activeVariants.length === 0) return;
                      if (quantity < 1 || quantity > 999) return;
                      if (isAdding || cartContext?.isMutating) return;

                      setIsAdding(true);
                      setAddSuccess(false);
                      setAddError(null);

                      try {
                        if (onAddToCart) {
                          await onAddToCart(selectedVariant.id, quantity);
                        } else if (cartContext) {
                          await cartContext.addItem(selectedVariant.id, quantity);
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
                        <span style={{ marginLeft: "var(--space-2)" }}>Adding...</span>
                      </>
                    ) : activeVariants.length === 0 ? (
                      "Out of Stock"
                    ) : (
                      "Add to Cart"
                    )}
                  </button>
                </div>
              </div>

              {/* Description */}
              {product.description && (
                <div className="storefront-description-section">
                  <h2 className="storefront-section-heading">Description</h2>
                  <div className="storefront-description-content">
                    {product.description.split("\n\n").map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Back to Catalog Link */}
              <div className="storefront-back-action">
                <a href={catalogHref} className="btn btn-outline btn-md storefront-back-btn">
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
