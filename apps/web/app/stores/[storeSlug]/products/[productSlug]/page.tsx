
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
            className="product-page-state product-page-loading"
            data-testid="product-detail-loading"
            aria-busy="true"
            aria-live="polite"
          >
            <div className="product-loading-card">
              <div className="product-loading-mark">
                <Spinner size="lg" />
              </div>
              <p className="product-state-eyebrow">JUST A MOMENT</p>
              <h1>Preparing something good.</h1>
              <p className="product-state-description">
                We’re getting the product details ready for you.
              </p>
              <div className="product-loading-track" aria-hidden="true">
                <span />
              </div>
            </div>
          </section>
        ) : isNotFound ? (
          <section
            className="product-page-state"
            data-testid="product-not-found"
          >
            <div className="product-state-card">
              <div className="product-state-symbol" aria-hidden="true">
                404
              </div>
              <p className="product-state-eyebrow">WRONG TURN?</p>
              <h1>This product isn’t here.</h1>
              <p className="product-state-description">
                It may have been removed, archived, or unpublished. Let’s get
                you back to the catalog.
              </p>
              <a href={catalogHref} className="product-state-primary">
                Explore the catalog <span aria-hidden="true">↗</span>
              </a>
            </div>
          </section>
        ) : error || !product ? (
          <section
            className="product-page-state"
            data-testid="product-detail-error"
          >
            <div className="product-state-card product-error-card">
              <div className="product-state-symbol" aria-hidden="true">
                !
              </div>
              <p className="product-state-eyebrow">A SMALL SETBACK</p>
              <h1>We couldn’t load this product.</h1>
              <p className="product-state-description">
                {error?.message ||
                  "Something unexpected happened while loading this product."}
              </p>

              <div className="product-state-actions">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void fetchProduct()}
                >
                  Try again
                </Button>
                <a href={catalogHref} className="product-state-secondary">
                  Back to catalog
                </a>
              </div>

              <div className="product-error-alert">
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
