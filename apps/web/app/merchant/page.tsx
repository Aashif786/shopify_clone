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
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-16) 0" }}>
          <Spinner size="lg" label="Loading merchant console..." />
        </div>
      ) : !activeStore ? (
        <EmptyState
          title="No Active Store Selected"
          description="Select a store from the sidebar or configure your merchant store to manage commerce operations."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Welcome Banner */}
          <div className="merchant-banner">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
                <span style={{ fontSize: "12px", color: "var(--color-primary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Merchant Console
                </span>
                <span style={{ color: "var(--color-border-strong)" }}>•</span>
                <Badge variant="success" size="sm">
                  Live Demo Mode
                </Badge>
              </div>
              <h2 className="merchant-banner-title">
                Welcome back, {user?.name || "Merchant"}
              </h2>
              <p className="merchant-banner-desc">
                Managing store <strong>{activeStore.name}</strong> (slug: <code>{activeStore.slug}</code>) • Currency: <strong>{activeStore.currency || "USD"}</strong>
              </p>
            </div>
            <div className="merchant-banner-actions">
              <a
                href={`/stores/${encodeURIComponent(activeStore.slug)}/products`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-md"
              >
                View Customer Storefront ↗
              </a>
              <a href="/merchant/products/new" className="btn btn-primary btn-md">
                + New Product
              </a>
            </div>
          </div>

          {/* Core Metrics Grid */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div>
                <div className="kpi-card-header">
                  <h3 className="kpi-card-title">Catalog Products</h3>
                  <div className="kpi-card-icon" aria-hidden="true">
                    📦
                  </div>
                </div>
                <div className="kpi-card-value">
                  {isLoadingMetrics ? "..." : (metrics.productCount ?? "—")}
                </div>
                <div className="kpi-card-subtext">Published catalog items & variants</div>
              </div>
              <div className="kpi-card-footer">
                <a href="/merchant/products" className="btn btn-primary btn-sm">
                  Manage Products →
                </a>
                <a href="/merchant/products/new" className="btn btn-ghost btn-sm">
                  + Add
                </a>
              </div>
            </div>

            <div className="kpi-card">
              <div>
                <div className="kpi-card-header">
                  <h3 className="kpi-card-title">Discounts & Promos</h3>
                  <div className="kpi-card-icon" aria-hidden="true">
                    🏷️
                  </div>
                </div>
                <div className="kpi-card-value">
                  {isLoadingMetrics ? "..." : (metrics.discountCount ?? "—")}
                </div>
                <div className="kpi-card-subtext">Active coupon rules & thresholds</div>
              </div>
              <div className="kpi-card-footer">
                <a href="/merchant/discounts" className="btn btn-primary btn-sm">
                  Manage Discounts →
                </a>
                <a href="/merchant/discounts/new" className="btn btn-ghost btn-sm">
                  + Create
                </a>
              </div>
            </div>

            <div className="kpi-card">
              <div>
                <div className="kpi-card-header">
                  <h3 className="kpi-card-title">Order Processing</h3>
                  <div className="kpi-card-icon" aria-hidden="true">
                    ⚡
                  </div>
                </div>
                <div className="kpi-card-value">
                  Active
                </div>
                <div className="kpi-card-subtext">Razorpay test mode & checkout engine</div>
              </div>
              <div className="kpi-card-footer">
                <a href="/merchant/orders" className="btn btn-secondary btn-sm">
                  Orders Pipeline →
                </a>
              </div>
            </div>

            <div className="kpi-card">
              <div>
                <div className="kpi-card-header">
                  <h3 className="kpi-card-title">Tenant Security</h3>
                  <div className="kpi-card-icon" aria-hidden="true">
                    🔒
                  </div>
                </div>
                <div className="kpi-card-value">
                  Isolated
                </div>
                <div className="kpi-card-subtext">Role: {(activeStore.role || "OWNER").toUpperCase()} • PostgreSQL Scoped</div>
              </div>
              <div className="kpi-card-footer">
                <a href="/merchant/team" className="btn btn-secondary btn-sm">
                  Staff & Roles →
                </a>
              </div>
            </div>
          </div>

          {/* Quick Actions & Workflows */}
          <Card>
            <CardHeader>
              <CardTitle>Merchant Operations</CardTitle>
              <CardDescription>Primary administrative workflows for this store</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="action-grid">
                <a href="/merchant/products" className="action-card">
                  <div className="action-card-header">
                    <div className="action-card-icon" aria-hidden="true">📦</div>
                    <div>
                      <h4 className="action-card-title">Product Catalog</h4>
                      <p className="action-card-desc">Create and manage items, variants, minor-unit prices, and publishing.</p>
                    </div>
                  </div>
                  <span className="action-card-link-text">Manage catalog →</span>
                </a>

                <a href="/merchant/discounts" className="action-card">
                  <div className="action-card-header">
                    <div className="action-card-icon" aria-hidden="true">🏷️</div>
                    <div>
                      <h4 className="action-card-title">Promotions & Coupons</h4>
                      <p className="action-card-desc">Configure percentage or fixed discounts with minimum spend rules.</p>
                    </div>
                  </div>
                  <span className="action-card-link-text">Manage discounts →</span>
                </a>

                <a
                  href={`/stores/${encodeURIComponent(activeStore.slug)}/products`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="action-card"
                >
                  <div className="action-card-header">
                    <div className="action-card-icon" aria-hidden="true">🛍️</div>
                    <div>
                      <h4 className="action-card-title">Storefront Preview</h4>
                      <p className="action-card-desc">Test the live storefront catalog, cart drawer, and Razorpay checkout.</p>
                    </div>
                  </div>
                  <span className="action-card-link-text">Open storefront ↗</span>
                </a>

                <a href="/merchant/stores" className="action-card">
                  <div className="action-card-header">
                    <div className="action-card-icon" aria-hidden="true">🏪</div>
                    <div>
                      <h4 className="action-card-title">Store Switcher</h4>
                      <p className="action-card-desc">Switch between merchant stores under your organization account.</p>
                    </div>
                  </div>
                  <span className="action-card-link-text">Switch store →</span>
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Architectural Readiness & Roadmap */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--space-6)" }}>
            <Card>
              <CardHeader>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <CardTitle>Architecture & Verification</CardTitle>
                  <Badge variant="info" size="sm">PostgreSQL 16</Badge>
                </div>
                <CardDescription>Verified backend foundation powering this demo</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="verified-backend-list">
                  <li className="verified-backend-item">
                    <span className="verified-backend-check">✓</span>
                    <div>
                      <strong>Authoritative Cart & Pricing:</strong> Variant prices and discounts calculated server-side; client overrides rejected.
                    </div>
                  </li>
                  <li className="verified-backend-item">
                    <span className="verified-backend-check">✓</span>
                    <div>
                      <strong>Payment Signature Security:</strong> Cryptographic HMAC SHA256 validation for Razorpay callbacks and webhooks.
                    </div>
                  </li>
                  <li className="verified-backend-item">
                    <span className="verified-backend-check">✓</span>
                    <div>
                      <strong>Concurrency-Safe Inventory:</strong> Row-level locks (<code>FOR UPDATE</code>) preventing stock overselling during checkout.
                    </div>
                  </li>
                  <li className="verified-backend-item">
                    <span className="verified-backend-check">✓</span>
                    <div>
                      <strong>Multi-Tenant Isolation:</strong> Queries strictly scoped to store ID and organization boundaries at the database layer.
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <CardTitle>Milestone Roadmap</CardTitle>
                  <Badge variant="neutral" size="sm">Demo Evolution</Badge>
                </div>
                <CardDescription>Rollout plan for merchant operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="roadmap-grid" style={{ gridTemplateColumns: "1fr" }}>
                  <div className="roadmap-card roadmap-card--current">
                    <div className="roadmap-card-header">
                      <h4 className="roadmap-card-title">Milestone A: UI Foundation & Shell</h4>
                      <Badge variant="success" size="sm">Current</Badge>
                    </div>
                    <p className="roadmap-card-desc">Modernized SaaS dashboard layout, responsive sidebar, design tokens, standardized typography and card structure.</p>
                  </div>
                  <div className="roadmap-card">
                    <div className="roadmap-card-header">
                      <h4 className="roadmap-card-title">Milestone B: Store & Team Management</h4>
                      <Badge variant="neutral" size="sm">Planned</Badge>
                    </div>
                    <p className="roadmap-card-desc">Store creation and switching, store settings lifecycle, staff invitations and role-based permissions.</p>
                  </div>
                  <div className="roadmap-card">
                    <div className="roadmap-card-header">
                      <h4 className="roadmap-card-title">Milestone C: Core Operations</h4>
                      <Badge variant="neutral" size="sm">Planned</Badge>
                    </div>
                    <p className="roadmap-card-desc">Orders listing and details, inventory stock adjustments and audit history, customer management.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </MerchantShell>
  );
}
