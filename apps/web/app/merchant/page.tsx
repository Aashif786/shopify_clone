"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  ShoppingBag,
  Percent,
  TrendingUp,
  Boxes,
  Users,
  ExternalLink,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState, Spinner } from "@shopify-clone/ui";
import type { SalesOverviewDto } from "@shopify-clone/orders";
import { MerchantShell } from "../../src/components/merchant/MerchantShell";
import { useAuth } from "../../src/context/auth-context";
import { useStore } from "../../src/context/store-context";
import { apiClient } from "../../src/lib/api-client";
import { formatOrderPrice } from "../../src/lib/merchant-order-helpers";

export default function MerchantDashboardPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const {
    activeStore,
    stores,
    isLoading: isStoreLoading,
    selectStore,
  } = useStore();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push("/merchant/login");
      return;
    }
    if (!isAuthLoading && user && !isStoreLoading && stores.length === 0) {
      router.push("/merchant/onboarding");
    }
  }, [isAuthLoading, user, isStoreLoading, stores.length, router]);

  const [metrics, setMetrics] = useState<{
    productCount: number | null;
    discountCount: number | null;
    netSales: number | null;
    orderCount: number | null;
  }>({
    productCount: null,
    discountCount: null,
    netSales: null,
    orderCount: null,
  });
  const [isLoadingMetrics, setIsLoadingMetrics] = useState<boolean>(false);

  useEffect(() => {
    if (!activeStore) {
      setMetrics({
        productCount: null,
        discountCount: null,
        netSales: null,
        orderCount: null,
      });
      return;
    }

    let isMounted = true;
    setIsLoadingMetrics(true);
    setMetrics({
      productCount: null,
      discountCount: null,
      netSales: null,
      orderCount: null,
    });

    async function loadMetrics() {
      try {
        const [productsRes, discountsRes, analyticsRes] = await Promise.allSettled([
          apiClient.get<{ total?: number; items: unknown[] }>(
            `/api/v1/stores/${activeStore!.id}/products?limit=1`,
            { storeId: activeStore!.id }
          ),
          apiClient.get<{ total?: number; items: unknown[] }>(
            `/api/v1/stores/${activeStore!.id}/discounts?limit=1`,
            { storeId: activeStore!.id }
          ),
          apiClient.get<SalesOverviewDto>(
            `/api/v1/stores/${activeStore!.id}/analytics/overview?period=30d`,
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
          netSales:
            analyticsRes.status === "fulfilled"
              ? analyticsRes.value.current.netSales
              : null,
          orderCount:
            analyticsRes.status === "fulfilled"
              ? analyticsRes.value.current.orderCount
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
      userRole={activeStore?.role}
      onLogout={logout}
      title="Overview"
    >
      {isLoading ? (
        <div className="flex justify-center items-center py-24">
          <Spinner size="lg" label="Loading merchant console..." />
        </div>
      ) : !activeStore ? (
        <div className="max-w-xl mx-auto py-16 text-center">
          <EmptyState
            title="No Active Store Selected"
            description="Select a store from the sidebar or create a new merchant store to manage commerce operations."
            action={
              <a href="/merchant/stores/new" className="btn btn-primary btn-md">
                + Create Store
              </a>
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Action Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Store Overview</span>
                <span className="text-border">•</span>
                <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                  {activeStore.currency || "USD"}
                </Badge>
                {activeStore.status && (
                  <Badge
                    variant={activeStore.status === "ACTIVE" ? "default" : "secondary"}
                    className="text-[10px] uppercase font-semibold"
                  >
                    {activeStore.status}
                  </Badge>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                {activeStore.name}
              </h1>
              <p className="text-xs text-muted-foreground">
                Slug: <code className="px-1.5 py-0.5 rounded bg-muted font-mono">{activeStore.slug}</code> • Role: <strong className="uppercase">{activeStore.role || "OWNER"}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/merchant/products/new"
                className="btn btn-primary btn-sm rounded-lg px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>Add Product</span>
              </Link>
              <Link
                href="/merchant/discounts/new"
                className="btn btn-outline btn-sm rounded-lg px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Percent size={13} />
                <span>New Discount</span>
              </Link>
              <a
                href={`/stores/${encodeURIComponent(activeStore.slug)}/products`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm rounded-lg px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <span>Storefront</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          {/* 4-Column Dense Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Revenue */}
            <Card className="rounded-2xl border-border/70 bg-card/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Net Revenue
                </CardTitle>
                <TrendingUp size={16} className="text-primary" />
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-extrabold tracking-tight text-foreground">
                  {isLoadingMetrics ? "..." : metrics.netSales !== null ? formatOrderPrice(metrics.netSales, activeStore.currency || "USD") : "—"}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>Last 30 days</span>
                  <Link href="/merchant/analytics" className="text-primary hover:underline font-semibold">
                    Analytics →
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Orders */}
            <Card className="rounded-2xl border-border/70 bg-card/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Orders
                </CardTitle>
                <ShoppingBag size={16} className="text-primary" />
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-extrabold tracking-tight text-foreground">
                  {isLoadingMetrics ? "..." : metrics.orderCount !== null ? metrics.orderCount : "—"}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>Completed & Pending</span>
                  <Link href="/merchant/orders" className="text-primary hover:underline font-semibold">
                    Orders →
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Products */}
            <Card className="rounded-2xl border-border/70 bg-card/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Catalog Products
                </CardTitle>
                <Package size={16} className="text-primary" />
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-extrabold tracking-tight text-foreground">
                  {isLoadingMetrics ? "..." : metrics.productCount !== null ? metrics.productCount : "—"}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>Active & Draft items</span>
                  <Link href="/merchant/products" className="text-primary hover:underline font-semibold">
                    Manage →
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Active Discounts */}
            <Card className="rounded-2xl border-border/70 bg-card/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Promotions
                </CardTitle>
                <Percent size={16} className="text-primary" />
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-extrabold tracking-tight text-foreground">
                  {isLoadingMetrics ? "..." : metrics.discountCount !== null ? metrics.discountCount : "—"}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>Active Coupon Rules</span>
                  <Link href="/merchant/discounts" className="text-primary hover:underline font-semibold">
                    Discounts →
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Operations & Resource Center */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 8 Cols: Commerce Navigation Hub */}
            <div className="lg:col-span-8 space-y-6">
              <Card className="rounded-2xl border-border/70 bg-card/60">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-foreground">Merchant Operations Hub</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Quick access to store modules, inventory controls, and order processing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Link
                      href="/merchant/products"
                      className="group p-4 rounded-xl border border-border/70 bg-background/50 hover:border-primary/50 hover:bg-muted/40 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Package size={16} className="text-primary" />
                          <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                            Product Catalog
                          </h3>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Manage product titles, descriptions, variants, multi-currency prices, and status.
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Manage products →
                      </span>
                    </Link>

                    <Link
                      href="/merchant/inventory"
                      className="group p-4 rounded-xl border border-border/70 bg-background/50 hover:border-primary/50 hover:bg-muted/40 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Boxes size={16} className="text-primary" />
                          <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                            Inventory & Stock
                          </h3>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Track stock levels, record manual adjustments, and audit inventory movements.
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Stock control →
                      </span>
                    </Link>

                    <Link
                      href="/merchant/orders"
                      className="group p-4 rounded-xl border border-border/70 bg-background/50 hover:border-primary/50 hover:bg-muted/40 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <ShoppingBag size={16} className="text-primary" />
                          <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                            Orders & Fulfillment
                          </h3>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          View customer orders, fulfill line items, and process Razorpay refunds.
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        View orders →
                      </span>
                    </Link>

                    <Link
                      href="/merchant/customers"
                      className="group p-4 rounded-xl border border-border/70 bg-background/50 hover:border-primary/50 hover:bg-muted/40 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Users size={16} className="text-primary" />
                          <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                            Customer Directory
                          </h3>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Customer profiles, shipping addresses, order histories, and account status.
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Manage customers →
                      </span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right 4 Cols: Store Health & Security */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="rounded-2xl border-border/70 bg-card/60">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-foreground">Tenant & Security</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Isolation status and access control
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/50">
                    <span className="text-muted-foreground">Tenant Isolation</span>
                    <Badge variant="outline" className="text-emerald-500 font-semibold border-emerald-500/30">
                      PostgreSQL Scoped
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/50">
                    <span className="text-muted-foreground">Active Role</span>
                    <Badge variant="secondary" className="font-semibold">
                      {(activeStore.role || "OWNER").toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/50">
                    <span className="text-muted-foreground">Payment Engine</span>
                    <span className="font-semibold text-foreground">Razorpay Test Mode</span>
                  </div>
                  <div className="pt-2">
                    <Link
                      href="/merchant/settings"
                      className="btn btn-outline btn-sm w-full rounded-lg text-xs font-semibold justify-center"
                    >
                      Store Settings →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </MerchantShell>
  );
}
