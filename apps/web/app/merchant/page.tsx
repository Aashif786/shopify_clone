"use client";

import React, { useEffect, useState } from "react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
} from "@shopify-clone/ui";
import { MerchantShell } from "../../src/components/merchant/MerchantShell";
import { useAuth } from "../../src/context/auth-context";
import { useStore } from "../../src/context/store-context";
import { apiClient } from "../../src/lib/api-client";

export default function MerchantDashboardPage() {
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const {
    activeStore,
    stores,
    isLoading: isStoreLoading,
    selectStore,
  } = useStore();

  const [metrics, setMetrics] = useState<{
    productCount: number | null;
    discountCount: number | null;
  }>({
    productCount: null,
    discountCount: null,
  });
  const [isLoadingMetrics, setIsLoadingMetrics] = useState<boolean>(false);

  useEffect(() => {
    if (!activeStore) return;

    let isMounted = true;
    setIsLoadingMetrics(true);

    async function loadMetrics() {
      try {
        const [productsRes, discountsRes] = await Promise.allSettled([
          apiClient.get<{ total?: number; items: unknown[] }>(
            `/api/v1/stores/${activeStore!.id}/products?limit=1`,
            { storeId: activeStore!.id }
          ),
          apiClient.get<{ total?: number; items: unknown[] }>(
            `/api/v1/stores/${activeStore!.id}/discounts?limit=1`,
            { storeId: activeStore!.id }
          ),
        ]);

        if (!isMounted) return;

        setMetrics({
          productCount:
            productsRes.status === "fulfilled"
              ? (productsRes.value.total ?? productsRes.value.items?.length ?? 0)
              : null,
          discountCount:
            discountsRes.status === "fulfilled"
              ? (discountsRes.value.total ?? discountsRes.value.items?.length ?? 0)
              : null,
        });
      } catch {
        // Fallback gracefully without breaking dashboard
      } finally {
        if (isMounted) {
          setIsLoadingMetrics(false);
        }
      }
    }

    loadMetrics();

    return () => {
      isMounted = false;
    };
  }, [activeStore]);

  const isLoading = isAuthLoading || isStoreLoading;

  return (
    <MerchantShell
      activePath="/merchant"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant User"}
      userEmail={user?.email}
      onLogout={logout}
      title="Merchant Dashboard"
    >
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-12)" }}>
          <Spinner size="lg" />
        </div>
      ) : !activeStore ? (
        <EmptyState
          title="No Active Store Selected"
          description="Select a store from the sidebar or configure your merchant store to manage commerce operations."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Welcome Banner */}
          <div
            style={{
              padding: "var(--space-6)",
              backgroundColor: "var(--color-surface)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--space-4)",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "var(--font-size-xl)", fontWeight: "var(--font-weight-bold)" }}>
                Welcome, {user?.name || "Merchant"}
              </h2>
              <p style={{ margin: "var(--space-1) 0 0", color: "var(--color-text-muted)" }}>
                Managing <strong>{activeStore.name}</strong> ({activeStore.slug})
              </p>
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
              <Badge variant="success" size="md">
                Active Store
              </Badge>
              <a
                href={`/stores/${encodeURIComponent(activeStore.slug)}/products`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
              >
                View Customer Storefront ↗
              </a>
            </div>
          </div>

          {/* Core Metrics Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "var(--space-4)",
            }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Catalog Products</CardTitle>
                <CardDescription>Published items & variants</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ fontSize: "var(--font-size-3xl)", fontWeight: "var(--font-weight-bold)", color: "var(--color-primary)" }}>
                  {isLoadingMetrics ? "..." : (metrics.productCount ?? "—")}
                </div>
                <div style={{ marginTop: "var(--space-3)", display: "flex", gap: "var(--space-2)" }}>
                  <a href="/merchant/products" className="btn btn-primary btn-sm">
                    Manage Products →
                  </a>
                  <a href="/merchant/products/new" className="btn btn-secondary btn-sm">
                    + New
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Discounts & Promos</CardTitle>
                <CardDescription>Active promotional campaigns</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ fontSize: "var(--font-size-3xl)", fontWeight: "var(--font-weight-bold)", color: "var(--color-primary)" }}>
                  {isLoadingMetrics ? "..." : (metrics.discountCount ?? "—")}
                </div>
                <div style={{ marginTop: "var(--space-3)", display: "flex", gap: "var(--space-2)" }}>
                  <a href="/merchant/discounts" className="btn btn-primary btn-sm">
                    Manage Discounts →
                  </a>
                  <a href="/merchant/discounts/new" className="btn btn-secondary btn-sm">
                    + New
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Orders & Fulfillment</CardTitle>
                <CardDescription>End-to-end checkout & orders</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ fontSize: "var(--font-size-3xl)", fontWeight: "var(--font-weight-bold)", color: "var(--color-text)" }}>
                  Live Demo
                </div>
                <div style={{ marginTop: "var(--space-3)" }}>
                  <Badge variant="neutral" size="sm">
                    Razorpay & Order Engine Active
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions & Store Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Store Configuration & Tenant Scoping</CardTitle>
              <CardDescription>Authoritative details for this store instance</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "var(--space-4)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                <div>
                  <div style={{ color: "var(--color-text-muted)" }}>Store Identifier</div>
                  <code style={{ fontSize: "var(--font-size-xs)" }}>{activeStore.id}</code>
                </div>
                <div>
                  <div style={{ color: "var(--color-text-muted)" }}>Store Slug</div>
                  <strong>{activeStore.slug}</strong>
                </div>
                <div>
                  <div style={{ color: "var(--color-text-muted)" }}>Store Currency</div>
                  <strong>{activeStore.currency || "USD"}</strong>
                </div>
                <div>
                  <div style={{ color: "var(--color-text-muted)" }}>Tenant Scoping</div>
                  <Badge variant="info" size="sm">
                    Enforced Server-Side
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </MerchantShell>
  );
}
