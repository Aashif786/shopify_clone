"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import type { ProductDetailDTO } from "@calcart/products";
import { Alert, Button, EmptyState, Spinner } from "@calcart/ui";
import { MerchantShell } from "../../../../src/components/merchant/MerchantShell";
import { ProductDetails } from "../../../../src/components/merchant/products/product-details";
import { ProductEditForm } from "../../../../src/components/merchant/products/product-edit-form";
import { useAuth } from "../../../../src/context/auth-context";
import { useStore } from "../../../../src/context/store-context";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";

interface ProductPageProps {
  params: Promise<{ productId: string }>;
}

export default function MerchantProductDetailPage({ params }: ProductPageProps) {
  const { productId } = use(params);
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const {
    activeStore,
    stores,
    isLoading: isStoreLoading,
    selectStore,
  } = useStore();

  const [product, setProduct] = useState<ProductDetailDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const fetchProduct = useCallback(async () => {
    if (!activeStore) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<ProductDetailDTO>(
        `/api/v1/stores/${activeStore.id}/products/${productId}`,
        { storeId: activeStore.id }
      );
      setProduct(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err
          : new ApiClientError({
              code: "FETCH_FAILED",
              message: "Failed to load product details",
              status: 500,
            })
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeStore, productId]);

  useEffect(() => {
    if (activeStore) {
      fetchProduct();
    } else if (!isStoreLoading) {
      setIsLoading(false);
    }
  }, [activeStore, isStoreLoading, fetchProduct]);

  const isNotFound = error instanceof ApiClientError && error.status === 404;
  const isForbidden = error instanceof ApiClientError && error.status === 403;

  return (
    <MerchantShell
      title={product ? product.title : "Product Details"}
      activePath="/merchant/products"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name}
      userEmail={user?.email}
      userRole={activeStore?.role ?? "staff"}
      onLogout={logout}
    >
      <div className="merchant-product-detail-page space-y-4">
        {/* Breadcrumb Navigation */}
        <div>
          <Link
            href="/merchant/products"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Products</span>
          </Link>
        </div>

        {/* Global Store or Auth Loading */}
        {(isAuthLoading || isStoreLoading) && (
          <div className="flex justify-center items-center py-20">
            <Spinner size="lg" label="Loading store context..." />
          </div>
        )}

        {/* No active store selected */}
        {!isStoreLoading && !activeStore && (
          <EmptyState
            title="No Active Store"
            description="Please select or create a store to view product details."
            action={
              <Link href="/merchant" className="btn btn--outline btn--md">
                Go to Dashboard
              </Link>
            }
          />
        )}

        {/* Product Fetch Loading */}
        {!isStoreLoading && activeStore && isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Spinner size="lg" label="Loading product..." />
            <span className="text-xs text-muted-foreground font-medium">
              Loading product details...
            </span>
          </div>
        )}

        {/* 404 Not Found State */}
        {!isStoreLoading && activeStore && !isLoading && isNotFound && (
          <EmptyState
            title="Product Not Found"
            description="The requested product does not exist, belongs to another store, or has been deleted."
            action={
              <Link href="/merchant/products" className="btn btn--primary btn--md">
                View All Products
              </Link>
            }
          />
        )}

        {/* 403 Forbidden State */}
        {!isStoreLoading && activeStore && !isLoading && isForbidden && (
          <Alert variant="danger" title="Access Denied">
            You do not have permission to access product details in this store.
          </Alert>
        )}

        {/* General / Recoverable Network Error */}
        {!isStoreLoading && activeStore && !isLoading && error && !isNotFound && !isForbidden && (
          <Alert
            variant="danger"
            title="Error Loading Product"
            action={
              <Button variant="outline" size="sm" onClick={fetchProduct} className="gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </Button>
            }
          >
            {error.message || "An unexpected error occurred while loading product details."}
          </Alert>
        )}

        {/* Success: View / Edit modes */}
        {!isStoreLoading && activeStore && !isLoading && product && (
          <>
            {isEditing ? (
              <ProductEditForm
                product={product}
                storeId={activeStore.id}
                onSuccess={(updated) => {
                  setProduct(updated);
                  setIsEditing(false);
                }}
                onCancel={() => setIsEditing(false)}
              />
            ) : (
              <ProductDetails
                product={product}
                storeId={activeStore.id}
                userRole={activeStore.role ?? "staff"}
                onEditClick={() => setIsEditing(true)}
                onProductUpdate={(updated) => setProduct(updated)}
              />
            )}
          </>
        )}
      </div>
    </MerchantShell>
  );
}
