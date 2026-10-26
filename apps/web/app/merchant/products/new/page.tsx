"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import type { ProductDetailDTO } from "@shopify-clone/products";
import { Alert, EmptyState, Spinner } from "@shopify-clone/ui";
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
      <div className="new-product-page max-w-3xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/merchant/products"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Products</span>
          </Link>
        </div>

        {/* Page Title Header */}
        <div className="pb-3 border-b border-border/60 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Create Product
          </h1>
          <p className="text-xs text-muted-foreground">
            Add a new product to your active store catalog with variants and pricing
          </p>
        </div>

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
              description="You must select or create a store before creating products."
              action={
                <Link href="/merchant/stores/new" className="btn btn-primary btn-md">
                  Create Store
                </Link>
              }
            />
          </div>
        )}

        {/* Role permission notice for staff */}
        {!isStoreLoading && activeStore && isStaffOnly && (
          <div className="py-4">
            <Alert variant="warning" title="Staff Role Restricted">
              You are signed in with the Staff role. Product catalog modification typically requires Admin or Owner role privileges.
            </Alert>
          </div>
        )}

        {/* Success Banner upon creation */}
        {createdProduct && (
          <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 space-y-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
              <CheckCircle2 size={18} />
              <span>Product Created Successfully!</span>
            </div>
            <p className="text-xs text-muted-foreground">
              &ldquo;{createdProduct.title}&rdquo; was added to store catalog with handle <code>/{createdProduct.slug}</code>.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <Link
                href={`/merchant/products/${encodeURIComponent(createdProduct.id)}`}
                className="btn btn-primary btn-sm rounded-lg px-3 py-1.5 text-xs font-semibold"
              >
                View Product Details
              </Link>
              <button
                type="button"
                onClick={() => setCreatedProduct(null)}
                className="btn btn-outline btn-sm rounded-lg px-3 py-1.5 text-xs font-semibold"
              >
                Create Another
              </button>
            </div>
          </div>
        )}

        {/* Product Creation Form */}
        {!isStoreLoading && activeStore && !createdProduct && (
          <ProductForm
            storeId={activeStore.id}
            onSuccess={(product) => setCreatedProduct(product)}
            onCancel={() => {
              window.location.href = "/merchant/products";
            }}
          />
        )}
      </div>
    </MerchantShell>
  );
}
