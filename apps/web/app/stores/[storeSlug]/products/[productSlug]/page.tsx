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
  const [store, setStore] = useState<{
    id: string;
    name: string;
    slug: string;
    currency: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
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
    fetchProduct();
  }, [fetchProduct]);

  const isNotFound = error instanceof ApiClientError && error.status === 404;
  const catalogHref = `/stores/${encodeURIComponent(storeSlug)}/products`;

  // 1. Loading State
  if (isLoading) {
    return (
      <StorefrontShell
        storeName={store?.name || "Online Store"}
        storeSlug={storeSlug}
      >
        <div
          className="storefront-grid-state storefront-grid-loading"
          data-testid="product-detail-loading"
          aria-busy="true"
        >
          <Spinner size="lg" />
          <p className="storefront-grid-loading-text">Loading product details...</p>
        </div>
      </StorefrontShell>
    );
  }

  // 2. Product or Store Not Found State
  if (isNotFound) {
    return (
      <StorefrontShell
        storeName={store?.name || "Online Store"}
        storeSlug={storeSlug}
      >
        <div className="storefront-not-found-container" data-testid="product-not-found">
          <div
            className="card"
            style={{
              maxWidth: "600px",
              margin: "var(--space-12) auto",
              padding: "var(--space-8)",
              textAlign: "center",
            }}
          >
            <h1 style={{ fontSize: "var(--font-size-2xl)", marginBottom: "var(--space-2)" }}>
              Product Not Found
            </h1>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-6)" }}>
              The product you are looking for does not exist, has been archived, or is currently unpublished.
            </p>
            <a href={catalogHref} className="btn btn-primary btn-md">
              ← Return to Catalog
            </a>
          </div>
        </div>
      </StorefrontShell>
    );
  }

  // 3. General Error State
  if (error || !product) {
    return (
      <StorefrontShell
        storeName={store?.name || "Online Store"}
        storeSlug={storeSlug}
      >
        <div className="storefront-grid-state" data-testid="product-detail-error">
          <Alert
            variant="danger"
            title="Failed to load product"
            action={
              <Button variant="outline" size="sm" onClick={() => fetchProduct()}>
                Try Again
              </Button>
            }
          >
            {error?.message || "An unexpected error occurred while loading this product."}
          </Alert>
          <div style={{ marginTop: "var(--space-4)" }}>
            <a href={catalogHref} className="btn btn-outline btn-sm">
              ← Return to Catalog
            </a>
          </div>
        </div>
      </StorefrontShell>
    );
  }

  // 4. Product Detail View
  return (
    <CartProvider storeSlug={storeSlug}>
      <StorefrontShell
        storeName={store?.name || "Online Store"}
        storeSlug={storeSlug}
      >
        <ProductDetailView
          product={product}
          storeSlug={storeSlug}
          storeName={store?.name || "Online Store"}
          storeCurrency={store?.currency}
        />
      </StorefrontShell>
    </CartProvider>
  );
}
