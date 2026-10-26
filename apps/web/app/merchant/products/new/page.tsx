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
      <div className="new-product-page max-w-6xl mx-auto space-y-6">
        {/* Navigation Breadcrumb & Header Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border/60">
          <div className="space-y-1">
            <Link
              href="/merchant/products"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group mb-1"
            >
              <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Products</span>
            </Link>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Create Product
            </h1>
            <p className="text-xs text-muted-foreground">
              Add a new product to your active store catalog with variants, inventory, and pricing
            </p>
          </div>
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
          <div className="py-2">
            <Alert variant="warning" title="Staff Role Restricted">
              You are signed in with the Staff role. Product catalog modification typically requires Admin or Owner role privileges.
            </Alert>
          </div>
        )}

        {/* Success Banner upon creation */}
        {createdProduct && (
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
              <CheckCircle2 size={16} />
              <span>Product Created Successfully</span>
            </div>
            <p className="text-xs text-muted-foreground">
              &ldquo;{createdProduct.title}&rdquo; was added to store catalog with handle <code className="px-1.5 py-0.5 bg-muted rounded font-mono text-[11px] text-foreground">/{createdProduct.slug}</code>.
            </p>
            <div className="flex items-center gap-2 pt-1">
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
