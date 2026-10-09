"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import type { ProductDetailDTO } from "@shopify-clone/products";
import { Alert, Button, EmptyState, Spinner } from "@shopify-clone/ui";
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
      <div className="merchant-product-detail-page">
        {/* Breadcrumb Navigation */}
        <div style={{ marginBottom: "var(--space-4)" }}>
          <a
            href="/merchant/products"
            style={{
              color: "var(--color-text-secondary)",
              fontSize: "var(--text-sm)",
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1)",
              textDecoration: "none",
            }}
          >
            ← Back to Products
          </a>
        </div>

        {/* Global Store or Auth Loading */}
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
            description="Please select or create a store to view product details."
            action={
              <a href="/merchant" className="btn btn--outline btn--md">
                Go to Dashboard
              </a>
            }
          />
        )}

        {/* Product Fetch Loading */}
        {!isStoreLoading && activeStore && isLoading && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--space-12) 0",
              gap: "var(--space-3)",
            }}
          >
            <Spinner size="lg" label="Loading product..." />
            <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
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
              <a href="/merchant/products" className="btn btn--primary btn--md">
                View All Products
              </a>
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
              <Button variant="outline" size="sm" onClick={fetchProduct}>
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
