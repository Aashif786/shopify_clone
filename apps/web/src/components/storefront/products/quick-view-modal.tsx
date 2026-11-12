"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, ShoppingBag, ExternalLink } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useOptionalCart } from "../../../context/cart-context";

import { useCurrency } from "../../../context/currency-context";

import { Spinner, Badge } from "@calcart/ui";
import type { ProductDetailDTO, ProductVariantDTO } from "@calcart/products";

export interface QuickViewModalProps {
  productSlug: string | null;
  storeSlug: string;
  isOpen: boolean;
  onClose: () => void;
}

export function QuickViewModal({
  productSlug,
  storeSlug,
  isOpen,
  onClose,
}: QuickViewModalProps) {
  const [product, setProduct] = useState<ProductDetailDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantDTO | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  const cartContext = useOptionalCart();
  
  const { convertPrice } = useCurrency();

  // Load product detail on open
  useEffect(() => {
    if (!isOpen || !productSlug) {
      setProduct(null);
      setSelectedVariant(null);
      setSelectedImage(null);
      setQuantity(1);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    async function loadProduct() {
      try {
        const res = await apiClient.get<{ product: ProductDetailDTO }>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(productSlug!)}`,
        );
        if (isMounted && res.product) {
          setProduct(res.product);
          // Auto select first active variant
          const activeVariants = res.product.variants.filter((v) => v.status === "ACTIVE");
          const firstVar = activeVariants[0] || res.product.variants[0] || null;
          setSelectedVariant(firstVar);
          const firstImg = res.product.media?.[0]?.url || null;
          setSelectedImage(firstImg);
        }
      } catch (err) {
        console.error("Failed to load quick view product:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadProduct();
    return () => {
      isMounted = false;
    };
  }, [isOpen, productSlug, storeSlug]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  
  const price = selectedVariant?.price ?? product?.variants[0]?.price ?? 0;
  const compareAtPrice = selectedVariant?.compareAtPrice ?? product?.variants[0]?.compareAtPrice ?? null;
  const hasCompareAt = compareAtPrice !== null && compareAtPrice > price;
  const isOutOfStock = selectedVariant ? selectedVariant.inventoryQuantity !== undefined && selectedVariant.inventoryQuantity <= 0 : false;
  const priceConversion = convertPrice(price);
  const compareAtConversion = compareAtPrice !== null ? convertPrice(compareAtPrice) : null;

  

  const handleAddToCart = async () => {
    if (!selectedVariant || isAdding) return;
    setIsAdding(true);
    try {
      if (cartContext) {
        await cartContext.addItem(selectedVariant.id, quantity);
      }
      onClose();
    } catch {
      // Toast notification handles feedback
    } finally {
      setIsAdding(false);
    }
  };

  const productUrl = `/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(productSlug || "")}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-view-title"
      data-testid="quick-view-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-3xl rounded-3xl border border-border/80 bg-background text-foreground shadow-2xl overflow-hidden max-h-[90vh] flex flex-col md:flex-row"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground backdrop-blur-md transition-colors"
          aria-label="Close Quick View"
          data-testid="quick-view-close-btn"
        >
          <X size={18} />
        </button>

        {isLoading || !product ? (
          <div className="w-full py-32 flex flex-col items-center justify-center gap-3">
            <Spinner size="lg" />
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground animate-pulse">
              Loading product details...
            </span>
          </div>
        ) : (
          <>
            {/* Left Column: Image Gallery Preview */}
            <div className="w-full md:w-1/2 bg-muted/20 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-border/60">
              <div className="relative aspect-[3/4] w-full rounded-2xl overflow-hidden bg-muted/40 border border-border/50">
                {selectedImage ? (
                  <img
                    src={selectedImage}
                    alt={product.title}
                    className="w-full h-full object-cover object-center"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ShoppingBag size={48} className="opacity-30" />
                  </div>
                )}
                {hasCompareAt && (
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-destructive text-destructive-foreground shadow-sm">
                      SALE
                    </span>
                  </div>
                )}
              </div>

              {/* Thumbnail Strip */}
              {product.media && product.media.length > 1 && (
                <div className="flex gap-2 pt-4 overflow-x-auto scrollbar-none">
                  {product.media.map((med) => (
                    <button
                      key={med.id}
                      type="button"
                      onClick={() => setSelectedImage(med.url)}
                      className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                        selectedImage === med.url
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border/60 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img src={med.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Product Actions */}
            <div className="w-full md:w-1/2 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                {product.typeName && (
                  <span className="text-[11px] font-mono font-semibold tracking-wider uppercase text-muted-foreground block">
                    {product.typeName}
                  </span>
                )}

                <h2
                  id="quick-view-title"
                  className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground"
                >
                  {product.title}
                </h2>

                {/* Pricing */}
                <div className="flex items-baseline gap-2.5">
                  <span className="text-xl font-extrabold text-foreground font-mono">
                    {priceConversion.presentmentFormatted}
                  </span>
                  {hasCompareAt && compareAtConversion && (
                    <span className="text-sm font-medium text-muted-foreground line-through font-mono">
                      {compareAtConversion.presentmentFormatted}
                    </span>
                  )}
                  {isOutOfStock ? (
                    <Badge variant="warning" size="sm">Out of Stock</Badge>
                  ) : (
                    <Badge variant="success" size="sm">In Stock</Badge>
                  )}
                </div>

                {/* Short Description */}
                {product.description && (
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                    {product.description}
                  </p>
                )}

                {/* Variant Selector */}
                {product.variants.length > 1 && (
                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-semibold text-foreground block">
                      Options ({product.variants.length} available)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {product.variants.map((variant) => {
                        const isSelected = selectedVariant?.id === variant.id;
                        return (
                          <button
                            key={variant.id}
                            type="button"
                            onClick={() => setSelectedVariant(variant)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground border-border/80"
                            }`}
                          >
                            {variant.title === "Default Title" ? "Standard" : variant.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quantity Stepper */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-semibold text-foreground block">Quantity</label>
                  <div className="inline-flex items-center rounded-xl border border-border/80 bg-background p-1">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold hover:bg-muted transition-colors disabled:opacity-40"
                    >
                      -
                    </button>
                    <span className="w-10 text-center font-mono font-bold text-xs">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold hover:bg-muted transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-6 space-y-3 border-t border-border/60 mt-6">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isAdding || isOutOfStock}
                  className="w-full btn btn-primary btn-md rounded-2xl py-3 font-bold text-sm shadow-md hover:shadow-primary/20 transition-all flex items-center justify-center gap-2"
                  data-testid="quick-view-add-to-cart-btn"
                >
                  {isAdding ? (
                    <>
                      <Spinner size="sm" />
                      <span>Adding to cart...</span>
                    </>
                  ) : isOutOfStock ? (
                    "Out of Stock"
                  ) : (
                    <>
                      <ShoppingBag size={16} />
                      <span>Add to Cart ({priceConversion.presentmentFormatted})</span>
                    </>
                  )}
                </button>

                <Link
                  href={productUrl}
                  onClick={onClose}
                  className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 transition-colors pt-1"
                >
                  <span>View Full Product Details</span>
                  <ExternalLink size={13} />
                </Link>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
