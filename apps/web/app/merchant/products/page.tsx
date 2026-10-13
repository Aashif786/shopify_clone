"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { PaginatedResult } from "@shopify-clone/types";
import type { ProductSummaryDTO } from "@shopify-clone/products";
import { Spinner, EmptyState } from "@shopify-clone/ui";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { ProductTable } from "../../../src/components/merchant/products/product-table";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";
import { apiClient, ApiClientError } from "../../../src/lib/api-client";

export default function MerchantProductsPage() {
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const {
    activeStore,
    stores,
    isLoading: isStoreLoading,
    selectStore,
  } = useStore();

  const [products, setProducts] = useState<ProductSummaryDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  const fetchProducts = useCallback(
    async (cursor?: string) => {
      if (!activeStore) return;

      if (!cursor) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const queryParams: Record<string, string | number | undefined> = {
          limit: 20,
        };
        if (cursor) {
          queryParams.cursor = cursor;
        }

        const res = await apiClient.get<PaginatedResult<ProductSummaryDTO>>(
          `/api/v1/stores/${activeStore.id}/products`,
          {
            storeId: activeStore.id,
            params: queryParams,
          }
        );

        if (cursor) {
          setProducts((prev) => [...prev, ...res.items]);
        } else {
          setProducts(res.items);
        }

        setHasMore(res.hasMore);
        setNextCursor(res.nextCursor);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err
            : new ApiClientError({
                code: "FETCH_FAILED",
                message: "Failed to fetch products",
                status: 500,
              })
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [activeStore]
  );

  useEffect(() => {
    if (activeStore) {
      fetchProducts();
    } else if (!isStoreLoading) {
      setIsLoading(false);
      setProducts([]);
    }
  }, [activeStore, isStoreLoading, fetchProducts]);

  return (
    <MerchantShell
      title="Products"
      activePath="/merchant/products"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name}
      userEmail={user?.email}
      userRole={activeStore?.role ?? "staff"}
      onLogout={logout}
    >
      <div className="merchant-products-page">
        {/* Page Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-6)",
            flexWrap: "wrap",
            gap: "var(--space-4)",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "var(--text-xl)",
                fontWeight: "var(--font-bold)",
                color: "var(--color-text-primary)",
              }}
            >
              All Products
            </h2>
            <p
              style={{
                margin: "var(--space-1) 0 0 0",
                fontSize: "var(--text-sm)",
                color: "var(--color-text-secondary)",
              }}
            >
              Manage your store&apos;s product catalog, status, and details
            </p>
          </div>

          {activeStore && (
            <a
              href="/merchant/products/new"
              className="btn btn--primary btn--md"
              id="add-product-btn"
            >
              Add Product
            </a>
          )}
        </div>

        {/* Auth / Store Loading state */}
        {(isAuthLoading || isStoreLoading) && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "var(--space-12) 0",
            }}
          >
            <Spinner size="lg" label="Loading store context..." />
          </div>
        )}

        {/* No active store selected */}
        {!isStoreLoading && !activeStore && (
          <EmptyState
            title="No Active Store"
            description="You need to select or create a store before managing products."
            action={
              <a href="/merchant/stores/new" className="btn btn--primary btn--md">
                Create Store
              </a>
            }
          />
        )}

        {/* Products Table */}
        {!isStoreLoading && activeStore && (
          <ProductTable
            products={products}
            isLoading={isLoading}
            error={error}
            onRetry={() => fetchProducts()}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={() => fetchProducts(nextCursor)}
            onCreateProduct={() => {
              window.location.href = "/merchant/products/new";
            }}
          />
        )}
      </div>
    </MerchantShell>
  );
}
