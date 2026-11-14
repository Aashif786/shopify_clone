"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  ShoppingBag,
  Percent,
  Boxes,
  Users,
  Plus,
  ArrowUpRight,
  Settings,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Spinner } from "@calcart/ui";
import type { SalesOverviewDto } from "@calcart/orders";
import { MerchantShell } from "../../src/components/merchant/MerchantShell";
import { useAuth } from "../../src/context/auth-context";
import { useStore } from "../../src/context/store-context";
import { apiClient } from "../../src/lib/api-client";
import { Page, PageHeader, Panel, SplitGrid, StatStrip } from "../../src/components/merchant/ui";

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function formatDelta(delta?: number) {
  if (delta === undefined || delta === null || Number.isNaN(delta)) return "vs. prior 30 days";
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% vs. prior 30 days`;
}

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
        <Page>
          <PageHeader
            title={
              <span className="inline-flex items-center gap-2 flex-wrap">
                {activeStore.name}
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
              </span>
            }
            description={
              <>
                Handle <code className="font-mono text-foreground">{activeStore.slug}</code> &bull; Role{" "}
                <span className="font-semibold uppercase text-foreground">{activeStore.role || "OWNER"}</span>
              </>
            }
            actions={
              <>
                <Link href="/merchant/products/new" className="btn btn--primary btn--md">
                  <Plus size={14} />
                  <span>Add product</span>
                </Link>
                <Link href="/merchant/discounts/new" className="btn btn--secondary btn--md">
                  <Percent size={13} />
                  <span>New discount</span>
                </Link>
              </>
            }
          />

          <StatStrip
            items={[
              {
                label: "Net revenue (30d)",
                value: formatMoney(metrics.netSales ?? 0, activeStore.currency || "USD"),
                hint: formatDelta(metrics.salesDelta),
              },
              {
                label: "Orders (30d)",
                value: (metrics.orderCount ?? 0).toLocaleString(),
                hint: formatDelta(metrics.orderDelta),
              },
              { label: "Products", value: (metrics.productCount ?? 0).toLocaleString(), hint: "Active and draft" },
              { label: "Discounts", value: (metrics.discountCount ?? 0).toLocaleString(), hint: "Configured codes" },
            ]}
          />

          <SplitGrid>
            <Panel title="Operations" flush>
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0">
                {[
                  { href: "/merchant/products", label: "Product catalog", desc: "Titles, variants, prices, status", Icon: Package },
                  { href: "/merchant/inventory", label: "Inventory and stock", desc: "Levels, reservations, adjustments", Icon: Boxes },
                  { href: "/merchant/orders", label: "Orders and fulfillment", desc: "Fulfill, track, refund", Icon: ShoppingBag },
                  { href: "/merchant/customers", label: "Customers", desc: "Profiles, addresses, history", Icon: Users },
                ].map(({ href, label, desc, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group flex items-start gap-3 p-3 border-border hover:bg-muted/40 transition-colors sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(n+3)]:border-t"
                  >
                    <Icon size={16} className="mt-0.5 text-primary shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold text-foreground">{label}</span>
                      <span className="block text-[11px] text-muted-foreground">{desc}</span>
                    </span>
                    <ArrowUpRight size={13} className="text-muted-foreground group-hover:text-primary" />
                  </Link>
                ))}
              </div>
            </Panel>

            <Panel title="Store configuration">
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    Tenant security
                  </span>
                  <Badge variant="outline" className="text-[10px] text-emerald-500 font-semibold border-emerald-500/30">
                    Isolated
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <CreditCard size={14} className="text-primary" />
                    Payment gateway
                  </span>
                  <span className="font-semibold text-foreground text-[11px]">Razorpay Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Staff access role</span>
                  <Badge variant="secondary" className="font-semibold text-[10px]">
                    {(activeStore.role || "OWNER").toUpperCase()}
                  </Badge>
                </div>
                <div className="pt-2 grid grid-cols-2 gap-2">
                  <Link href="/merchant/settings" className="btn btn--secondary btn--sm">
                    <Settings size={13} />
                    Settings
                  </Link>
                  <Link href="/merchant/team" className="btn btn--secondary btn--sm">
                    <Users size={13} />
                    Team
                  </Link>
                </div>
              </div>
            </Panel>
          </SplitGrid>
        </Page>
      )}
    </MerchantShell>
  );
}
