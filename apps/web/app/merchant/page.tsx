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
  Plus,
  ArrowUpRight,
  Settings,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState, Spinner } from "@calcart/ui";
import type { SalesOverviewDto } from "@calcart/orders";
import { MerchantShell } from "../../src/components/merchant/MerchantShell";
import { useAuth } from "../../src/context/auth-context";
import { useStore } from "../../src/context/store-context";
import { apiClient } from "../../src/lib/api-client";
import { KpiCard } from "../../src/components/merchant/analytics/kpi-card";

export default function MerchantDashboardPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const {
    activeStore,
    stores,
    isLoading: isStoreLoading,
    hasLoaded,
    error: storeError,
    selectStore,
  } = useStore();

  useEffect(() => {
    if (isAuthLoading || isStoreLoading || !hasLoaded) {
      return;
    }
    if (!user) {
      router.push("/merchant/login");
      return;
    }
    if (stores.length === 0 && !storeError) {
      router.push("/merchant/onboarding");
    }
  }, [isAuthLoading, user, isStoreLoading, hasLoaded, stores.length, storeError, router]);

  const [metrics, setMetrics] = useState<{
    productCount: number | null;
    discountCount: number | null;
    netSales: number | null;
    orderCount: number | null;
    priorNetSales?: number;
    salesDelta?: number;
    priorOrderCount?: number;
    orderDelta?: number;
  }>({
    productCount: null,
    discountCount: null,
    netSales: null,
    orderCount: null,
  });

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

        const analytics = analyticsRes.status === "fulfilled" ? analyticsRes.value : null;

        setMetrics({
          productCount:
            productsRes.status === "fulfilled"
              ? (productsRes.value.total ?? productsRes.value.items?.length ?? 0)
              : null,
          discountCount:
            discountsRes.status === "fulfilled"
              ? (discountsRes.value.total ?? discountsRes.value.items?.length ?? 0)
              : null,
          netSales: analytics ? analytics.current.netSales : null,
          orderCount: analytics ? analytics.current.orderCount : null,
          priorNetSales: analytics?.prior?.netSales,
          salesDelta: analytics?.comparison?.netSalesDeltaPct,
          priorOrderCount: analytics?.prior?.orderCount,
          orderDelta: analytics?.comparison?.orderCountDeltaPct,
        });
      } catch {
        // Fallback gracefully without breaking dashboard
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
            description="Select a store from the top switcher or create a new merchant store to manage commerce operations."
            action={
              <Link href="/merchant/stores/new" className="btn btn-primary btn-md">
                + Create Store
              </Link>
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Streamlined Enterprise Action Bar — Zero bulky hero wrapping */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  {activeStore.name}
                </h1>
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
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <span>Handle: <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-foreground font-medium">{activeStore.slug}</code></span>
                <span>&bull;</span>
                <span>Role: <span className="font-semibold uppercase text-foreground">{activeStore.role || "OWNER"}</span></span>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
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
            </div>
          </div>

          {/* 4-Column High-Density KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Net Revenue (30d)"
              value={metrics.netSales ?? 0}
              isMonetary={true}
              currency={activeStore.currency || "USD"}
              priorValue={metrics.priorNetSales}
              deltaPct={metrics.salesDelta}
              helperText="vs. prior 30 days"
              icon={<TrendingUp size={15} />}
            />
            <KpiCard
              title="Orders (30d)"
              value={metrics.orderCount ?? 0}
              isMonetary={false}
              priorValue={metrics.priorOrderCount}
              deltaPct={metrics.orderDelta}
              helperText="vs. prior 30 days"
              icon={<ShoppingBag size={15} />}
            />
            <KpiCard
              title="Catalog Products"
              value={metrics.productCount ?? 0}
              isMonetary={false}
              helperText="Active & draft items"
              icon={<Package size={15} />}
            />
            <KpiCard
              title="Active Promotions"
              value={metrics.discountCount ?? 0}
              isMonetary={false}
              helperText="Configured discount codes"
              icon={<Percent size={15} />}
            />
          </div>

          {/* Operations Hub and Store Quick Details */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 8 Cols: Commerce Navigation Hub */}
            <div className="lg:col-span-8 space-y-6">
              <Card className="rounded-xl border-border/60 bg-card/50">
                <CardHeader className="pb-4 border-b border-border/40">
                  <CardTitle className="text-sm font-bold text-foreground">Merchant Operations Hub</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Direct access to core commerce modules and fulfillment workflows
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Link
                      href="/merchant/products"
                      className="group p-4 rounded-xl border border-border/60 bg-background/40 hover:border-border hover:bg-muted/30 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Package size={15} className="text-primary" />
                          <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                            Product Catalog
                          </h3>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Titles, descriptions, variants, multi-currency prices, and status.
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Manage products <ArrowUpRight size={12} />
                      </span>
                    </Link>

                    <Link
                      href="/merchant/inventory"
                      className="group p-4 rounded-xl border border-border/60 bg-background/40 hover:border-border hover:bg-muted/30 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Boxes size={15} className="text-primary" />
                          <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                            Inventory &amp; Stock
                          </h3>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Stock tracking, reservations, manual adjustments, and audit log.
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Stock control <ArrowUpRight size={12} />
                      </span>
                    </Link>

                    <Link
                      href="/merchant/orders"
                      className="group p-4 rounded-xl border border-border/60 bg-background/40 hover:border-border hover:bg-muted/30 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <ShoppingBag size={15} className="text-primary" />
                          <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                            Orders &amp; Fulfillment
                          </h3>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Fulfill orders, issue tracking numbers, and process refunds.
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        View orders <ArrowUpRight size={12} />
                      </span>
                    </Link>

                    <Link
                      href="/merchant/customers"
                      className="group p-4 rounded-xl border border-border/60 bg-background/40 hover:border-border hover:bg-muted/30 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Users size={15} className="text-primary" />
                          <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                            Customer Directory
                          </h3>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Customer profiles, shipping addresses, order histories, and accounts.
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Manage customers <ArrowUpRight size={12} />
                      </span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right 4 Cols: Quick Actions & Status */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="rounded-xl border-border/60 bg-card/50">
                <CardHeader className="pb-4 border-b border-border/40">
                  <CardTitle className="text-sm font-bold text-foreground">Store Configuration</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Store settings, team access, and payment setup
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/50">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <ShieldCheck size={14} className="text-emerald-500" />
                      Tenant Security
                    </span>
                    <Badge variant="outline" className="text-[10px] text-emerald-500 font-semibold border-emerald-500/30">
                      Isolated
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/50">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard size={14} className="text-primary" />
                      Payment Gateway
                    </span>
                    <span className="font-semibold text-foreground text-[11px]">Razorpay Active</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/50">
                    <span className="text-muted-foreground">Staff Access Role</span>
                    <Badge variant="secondary" className="font-semibold text-[10px]">
                      {(activeStore.role || "OWNER").toUpperCase()}
                    </Badge>
                  </div>
                  <div className="pt-2 flex flex-col gap-2">
                    <Link
                      href="/merchant/settings"
                      className="btn btn-outline btn-sm w-full rounded-lg text-xs font-semibold justify-center inline-flex items-center gap-1.5"
                    >
                      <Settings size={13} />
                      Store Settings
                    </Link>
                    <Link
                      href="/merchant/team"
                      className="btn btn-outline btn-sm w-full rounded-lg text-xs font-semibold justify-center inline-flex items-center gap-1.5"
                    >
                      <Users size={13} />
                      Team &amp; Roles
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
