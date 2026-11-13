"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ProductDetailDTO } from "@calcart/products";
import { Alert, Button } from "@calcart/ui";
import { ArrowUpRight, ArrowLeft } from "lucide-react";
import { StorefrontShell } from "../../../../../src/components/storefront/StorefrontShell";
import { ProductDetailView } from "../../../../../src/components/storefront/products/product-detail-view";
import { apiClient, ApiClientError } from "../../../../../src/lib/api-client";

interface StorefrontProductDetailPageProps {
  params: Promise<{ storeSlug: string; productSlug: string }>;
  searchParams?: Promise<{ variant?: string }>;
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
  searchParams,
}: StorefrontProductDetailPageProps) {
  const { storeSlug, productSlug } = use(params);
  const resolvedSearchParams = searchParams ? use(searchParams) : undefined;
  const initialVariantId = resolvedSearchParams?.variant || null;

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
        <StorefrontShell storeName={storeName} storeSlug={storeSlug} fullBleed>
        <div className="product-page">
          {isLoading ? (
            <section
              className="product-page-state product-page-loading at-container pb-24 pt-10"
              data-testid="product-detail-loading"
              aria-busy="true"
              aria-live="polite"
            >
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16" aria-hidden="true">
                <div className="at-skeleton aspect-[4/5] w-full lg:col-span-7" />
                <div className="space-y-5 lg:col-span-5">
                  <div className="at-skeleton h-3 w-1/4" />
                  <div className="at-skeleton h-10 w-4/5" />
                  <div className="at-skeleton h-6 w-1/4" />
                  <div className="at-skeleton h-12 w-full" />
                </div>
              </div>
              <h1 className="sr-only">Preparing piece details.</h1>
              <p className="sr-only">Loading product</p>
            </section>
          ) : isNotFound ? (
            <section
              className="product-page-state at-container py-24 text-center"
              data-testid="product-not-found"
            >
              <p className="product-state-eyebrow at-eyebrow text-muted-foreground">Unavailable item</p>
              <h1 className="at-display-lg mx-auto mt-3 max-w-2xl text-foreground">This product isn&apos;t here.</h1>
              <p className="product-state-description at-lede mx-auto mt-5 max-w-md text-muted-foreground">
                It may have been removed, archived, or unpublished. Let&apos;s get you back to the catalog.
              </p>
              <Link
                href={catalogHref}
                className="product-state-primary mt-8 ds-btn ds-btn-outline"
              >
                <span>Explore the catalog</span>
                <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </section>
          ) : error || !product ? (
            <section
              className="product-page-state at-container py-24 text-center"
              data-testid="product-detail-error"
            >
              <p className="product-state-eyebrow at-eyebrow text-muted-foreground">Something went wrong</p>
              <h1 className="at-display-lg mx-auto mt-3 max-w-2xl text-foreground">We couldn&apos;t load this product.</h1>
              <p className="product-state-description at-lede mx-auto mt-5 max-w-md text-muted-foreground">
                {error?.message || "Something unexpected happened while loading this product."}
              </p>
              <div className="product-state-actions mt-8 flex items-center justify-center gap-6">
                <Button variant="outline" size="md" onClick={() => void fetchProduct()} className="ds-btn ds-btn-outline">
                  Try again
                </Button>
                <Link href={catalogHref} className="product-state-secondary at-link inline-flex items-center gap-2 text-xs text-foreground">
                  <ArrowLeft size={13} strokeWidth={1.5} aria-hidden="true" />
                  <span>Back to catalog</span>
                </Link>
              </div>
              <div className="product-error-alert mx-auto mt-10 max-w-md text-left">
                <Alert variant="danger" title="Unable to display product">
                  Your cart and checkout data have not been changed by this page.
                </Alert>
              </div>
            </section>
          ) : (
            <div className="product-detail-stage" data-testid="product-detail">
              <ProductDetailView
                product={product}
                storeSlug={storeSlug}
                storeName={storeName}
                storeCurrency={store?.currency}
                initialVariantId={initialVariantId}
              />
            </div>
          )}
        </div>
      </StorefrontShell>
  );
}
