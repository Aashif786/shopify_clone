"use client";

import React, { useState } from "react";
import type { ProductDetailDTO } from "@shopify-clone/products";
import { Alert, Button, EmptyState, Spinner } from "@shopify-clone/ui";
import { MerchantShell } from "../../../../src/components/merchant/MerchantShell";
import { ProductForm } from "../../../../src/components/merchant/products/product-form";
import { useAuth } from "../../../../src/context/auth-context";
import { useStore } from "../../../../src/context/store-context";

export default function NewProductPage() {
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const {
    activeStore,
    stores,
    isLoading: isStoreLoading,
    selectStore,
  } = useStore();

  const [createdProduct, setCreatedProduct] = useState<ProductDetailDTO | null>(null);

  const isStaffOnly = activeStore?.role === "staff";

  return (
    <MerchantShell
      title="Add Product"
      activePath="/merchant/products"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name}
      userEmail={user?.email}
      userRole={activeStore?.role ?? "staff"}
      onLogout={logout}
    >
      <div className="new-product-page" style={{ maxWidth: "800px", margin: "0 auto" }}>
        {/* Navigation Breadcrumb */}
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

        {/* Page Title */}
        <div style={{ marginBottom: "var(--space-6)" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "var(--text-xl)",
              fontWeight: "var(--font-bold)",
              color: "var(--color-text-primary)",
            }}
          >
            Create Product
          </h2>
          <p
            style={{
              margin: "var(--space-1) 0 0 0",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
            }}
          >
            Add a new product to your active store catalog
          </p>
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
            description="You must select or create a store before creating products."
            action={
              <a href="/merchant/stores/new" className="btn btn--primary btn--md">
                Create Store
              </a>
            }
          />
        )}

        {/* Success Confirmation State */}
        {createdProduct && (
          <div style={{ marginBottom: "var(--space-6)" }}>
            <Alert
              variant="success"
              title="Product Created Successfully"
              action={
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreatedProduct(null)}
                  >
                    Add Another
                  </Button>
                  <a
                    href="/merchant/products"
                    className="btn btn--primary btn--sm"
                  >
                    View All Products
                  </a>
                </div>
              }
            >
              <strong>{createdProduct.title}</strong> has been created with status{" "}
              <strong>{createdProduct.status}</strong>.
            </Alert>
          </div>
        )}

        {/* Role Notice for Staff */}
        {!isStoreLoading && activeStore && isStaffOnly && (
          <div style={{ marginBottom: "var(--space-4)" }}>
            <Alert variant="warning" title="Permission Notice">
              You are currently signed in with staff permissions for this store. Creating products requires an Admin or Owner role. Submissions may be rejected by the server.
            </Alert>
          </div>
        )}

        {/* Product Form */}
        {!isStoreLoading && activeStore && !createdProduct && (
          <ProductForm
            storeId={activeStore.id}
            onSuccess={(product) => {
              setCreatedProduct(product);
            }}
            onCancel={() => {
              window.location.href = "/merchant/products";
            }}
          />
        )}
      </div>
    </MerchantShell>
  );
}
