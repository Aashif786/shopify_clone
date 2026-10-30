"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import type { PaginatedResult } from "@calcart/types";
import type { ProductSummaryDTO } from "@calcart/products";
import { Spinner, EmptyState } from "@calcart/ui";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { ProductTable } from "../../../src/components/merchant/products/product-table";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";
import { apiClient, ApiClientError } from "../../../src/lib/api-client";

export default function MerchantProductsPage() {
  const router = useRouter();
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

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

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

  // Client-side filtering for fast interactive feedback
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !searchTerm.trim() ||
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.slug.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "ALL" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [products, searchTerm, statusFilter]);

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
      headerActions={
        activeStore && (
          <Link
            href="/merchant/products/new"
            className="btn btn-primary btn-sm rounded-lg px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
            id="add-product-btn"
          >
            <Plus size={14} />
            <span>Add Product</span>
          </Link>
        )
      }
    >
      <div className="merchant-products-page space-y-6">
        {/* Page Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              All Products
            </h1>
            <p className="text-xs text-muted-foreground">
              Manage your store&apos;s product catalog, status, variants, and pricing
            </p>
          </div>

          {activeStore && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full border border-border/50">
                {products.length} {products.length === 1 ? "Product" : "Products"} Loaded
              </span>
            </div>
          )}
        </div>

        {/* Filter & Search Bar */}
        {activeStore && !isLoading && products.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl border border-border/70 bg-card/60 backdrop-blur-md">
            <div className="relative flex-1 w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search products by title or handle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              {(["ALL", "ACTIVE", "DRAFT", "ARCHIVED"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    statusFilter === st
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {st === "ALL" ? "All" : st.charAt(0) + st.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Auth / Store Loading state */}
        {(isAuthLoading || isStoreLoading) && (
          <div className="flex justify-center items-center py-20">
            <Spinner size="lg" label="Loading store context..." />
          </div>
        )}

        {/* No active store selected */}
        {!isStoreLoading && !activeStore && (
          <div className="max-w-md mx-auto py-16 text-center">
            <EmptyState
              title="No Active Store"
              description="You need to select or create a store before managing products."
              action={
                <Link href="/merchant/stores/new" className="btn btn-primary btn-md">
                  Create Store
                </Link>
              }
            />
          </div>
        )}

        {/* Products Table */}
        {!isStoreLoading && activeStore && (
          <ProductTable
            products={filteredProducts}
            isLoading={isLoading}
            error={error}
            onRetry={() => fetchProducts()}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={() => fetchProducts(nextCursor)}
            onCreateProduct={() => {
              router.push("/merchant/products/new");
            }}
          />
        )}
      </div>
    </MerchantShell>
  );
}
