"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import type { ProductDetailDTO } from "@shopify-clone/products";
import { Alert, Button, Spinner } from "@shopify-clone/ui";
import { StorefrontShell } from "../../../../../src/components/storefront/StorefrontShell";
import { ProductDetailView } from "../../../../../src/components/storefront/products/product-detail-view";
import { apiClient, ApiClientError } from "../../../../../src/lib/api-client";
import { CartProvider } from "../../../../../src/context/cart-context";

interface StorefrontProductDetailPageProps {
  params: Promise<{ storeSlug: string; productSlug: string }>;
}

interface StorefrontProductResponse {
  product: ProductDetailDTO;
  store: {
    id: string;
    name: string;
    slug: string;
    currency: string;
  };
}

export default function StorefrontProductDetailPage({
  params,
}: StorefrontProductDetailPageProps) {
  const { storeSlug, productSlug } = use(params);

  const [product, setProduct] = useState<ProductDetailDTO | null>(null);
  const [store, setStore] = useState<StorefrontProductResponse["store"] | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const fetchProduct = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<StorefrontProductResponse>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(productSlug)}`,
      );

      setProduct(data.product);
      setStore(data.store);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err
          : new ApiClientError({
              code: "FETCH_FAILED",
              message: "Failed to load product details",
              status: 500,
            }),
      );
    } finally {
      setIsLoading(false);
    }
  }, [storeSlug, productSlug]);

  useEffect(() => {
    void fetchProduct();
  }, [fetchProduct]);

  const storeName = store?.name || "Online Store";
  const catalogHref = `/stores/${encodeURIComponent(storeSlug)}/products`;
  const isNotFound =
    error instanceof ApiClientError && error.status === 404;

  return (
    <StorefrontShell storeName={storeName} storeSlug={storeSlug}>
      <main className="product-page">
        {isLoading ? (
          <section
            className="product-page-state product-page-loading max-w-md mx-auto py-24 px-4 text-center"
            data-testid="product-detail-loading"
            aria-busy="true"
            aria-live="polite"
          >
            <div className="product-loading-card p-10 rounded-3xl border border-border/60 bg-card/60 backdrop-blur-md shadow-sm space-y-4">
              <div className="product-loading-mark w-14 h-14 mx-auto rounded-2xl bg-muted/60 flex items-center justify-center">
                <Spinner size="lg" className="spinner spinner-lg text-primary" />
              </div>
              <p className="product-state-eyebrow text-xs font-mono font-bold tracking-widest text-primary">JUST A MOMENT</p>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Preparing something good.</h1>
              <p className="product-state-description text-xs text-muted-foreground">
                We’re getting the product details ready for you.
              </p>
              <div className="product-loading-track w-full h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                <span className="block h-full bg-primary animate-pulse w-2/3 rounded-full" />
              </div>
            </div>
          </section>
        ) : isNotFound ? (
          <section
            className="product-page-state max-w-md mx-auto py-24 px-4 text-center"
            data-testid="product-not-found"
          >
            <div className="product-state-card p-10 rounded-3xl border border-dashed border-border/80 bg-card/60 shadow-sm space-y-4">
              <div className="product-state-symbol text-4xl font-black text-muted-foreground" aria-hidden="true">
                404
              </div>
              <p className="product-state-eyebrow text-xs font-mono font-bold tracking-widest text-primary">WRONG TURN?</p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">This product isn’t here.</h1>
              <p className="product-state-description text-xs text-muted-foreground leading-relaxed">
                It may have been removed, archived, or unpublished. Let’s get
                you back to the catalog.
              </p>
              <div className="pt-2">
                <a href={catalogHref} className="product-state-primary btn btn-primary btn-md rounded-2xl px-6 py-2.5 text-xs font-semibold inline-flex items-center gap-1.5">
                  <span>Explore the catalog</span> <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </section>
        ) : error || !product ? (
          <section
            className="product-page-state max-w-md mx-auto py-24 px-4 text-center"
            data-testid="product-detail-error"
          >
            <div className="product-state-card product-error-card p-10 rounded-3xl border border-destructive/20 bg-destructive/5 shadow-sm space-y-4">
              <div className="product-state-symbol text-4xl font-bold text-destructive" aria-hidden="true">
                !
              </div>
              <p className="product-state-eyebrow text-xs font-mono font-bold tracking-widest text-destructive">A SMALL SETBACK</p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">We couldn’t load this product.</h1>
              <p className="product-state-description text-xs text-muted-foreground">
                {error?.message ||
                  "Something unexpected happened while loading this product."}
              </p>

              <div className="product-state-actions flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void fetchProduct()}
                  className="rounded-2xl px-5 text-xs font-semibold"
                >
                  Try again
                </Button>
                <a href={catalogHref} className="product-state-secondary btn btn-outline btn-md rounded-2xl px-5 text-xs font-semibold">
                  Back to catalog
                </a>
              </div>

              <div className="product-error-alert pt-2 text-left">
                <Alert variant="danger" title="Unable to display product">
                  Your cart and checkout data have not been changed by this
                  page.
                </Alert>
              </div>
            </div>
          </section>
        ) : (
          <CartProvider storeSlug={storeSlug}>
            <div className="product-detail-stage" data-testid="product-detail">
              <ProductDetailView
                product={product}
                storeSlug={storeSlug}
                storeName={storeName}
                storeCurrency={store?.currency}
              />
            </div>
          </CartProvider>
        )}
      </main>
    </StorefrontShell>
  );
}
