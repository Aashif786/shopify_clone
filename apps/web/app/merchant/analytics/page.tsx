"use client";

import React, { useCallback, useEffect, useState } from "react";
import type {
  AnalyticsQueryDto,
  CustomerAnalyticsDto,
  OrderAnalyticsDto,
  ProductAnalyticsDto,
  SalesOverviewDto,
} from "@shopify-clone/orders";
import { Alert, Button, EmptyState, Spinner } from "@shopify-clone/ui";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { CustomerAnalyticsCard } from "../../../src/components/merchant/analytics/customer-analytics-card";
import { DateRangeSelector } from "../../../src/components/merchant/analytics/date-range-selector";
import { KpiCard } from "../../../src/components/merchant/analytics/kpi-card";
import { LowStockTable } from "../../../src/components/merchant/analytics/low-stock-table";
import { OrderStatusChart } from "../../../src/components/merchant/analytics/order-status-chart";
import { SalesTrendChart } from "../../../src/components/merchant/analytics/sales-trend-chart";
import { TopProductsTable } from "../../../src/components/merchant/analytics/top-products-table";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";
import { apiClient } from "../../../src/lib/api-client";

export default function MerchantAnalyticsPage() {
  const { user, logout } = useAuth();
  const { activeStore, stores, selectStore, isLoading: isStoreLoading } = useStore();

  const [query, setQuery] = useState<AnalyticsQueryDto>({ period: "30d" });

  const [salesOverview, setSalesOverview] = useState<SalesOverviewDto | null>(null);
  const [orderAnalytics, setOrderAnalytics] = useState<OrderAnalyticsDto | null>(null);
  const [productAnalytics, setProductAnalytics] = useState<ProductAnalyticsDto | null>(null);
  const [customerAnalytics, setCustomerAnalytics] = useState<CustomerAnalyticsDto | null>(null);

  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadAnalytics = useCallback(
    async (storeId: string, currentQuery: AnalyticsQueryDto) => {
      setIsLoadingData(true);
      setFetchError(null);

      try {
        const queryParams = new URLSearchParams();
        if (currentQuery.period) queryParams.set("period", currentQuery.period);
        if (currentQuery.startDate) queryParams.set("startDate", currentQuery.startDate);
        if (currentQuery.endDate) queryParams.set("endDate", currentQuery.endDate);
        if (currentQuery.limit) queryParams.set("limit", currentQuery.limit.toString());

        const queryString = queryParams.toString();
        const base = `/api/v1/stores/${encodeURIComponent(storeId)}/analytics`;

        const [overviewRes, ordersRes, productsRes, customersRes] =
          await Promise.all([
            apiClient.get<SalesOverviewDto>(`${base}/overview?${queryString}`, { storeId }),
            apiClient.get<OrderAnalyticsDto>(`${base}/orders?${queryString}`, { storeId }),
            apiClient.get<ProductAnalyticsDto>(`${base}/products?${queryString}`, { storeId }),
            apiClient.get<CustomerAnalyticsDto>(`${base}/customers?${queryString}`, { storeId }),
          ]);

        setSalesOverview(overviewRes);
        setOrderAnalytics(ordersRes);
        setProductAnalytics(productsRes);
        setCustomerAnalytics(customersRes);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load store analytics from server";
        setFetchError(message);
      } finally {
        setIsLoadingData(false);
      }
    },
    []
  );

  useEffect(() => {
    if (activeStore?.id) {
      loadAnalytics(activeStore.id, query);
    }
  }, [activeStore?.id, query, loadAnalytics]);

  const handleRangeChange = (newQuery: AnalyticsQueryDto) => {
    setQuery(newQuery);
  };

  const currency = salesOverview?.currency || activeStore?.currency || "USD";

  return (
    <MerchantShell
      activePath="/merchant/analytics"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant User"}
      userEmail={user?.email}
      userRole={activeStore?.role}
      onLogout={logout}
      title="Store Analytics & Reports"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {/* Header and Filter Controls */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-3)",
          }}
        >
          <div>
            <h2 style={{ fontSize: "var(--font-size-xl, 20px)", fontWeight: 700, margin: 0 }}>
              Performance Overview
            </h2>
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", margin: "4px 0 0" }}>
              Verified commerce telemetry, revenue trends, and customer lifecycle reporting.
            </p>
          </div>

          <DateRangeSelector
            currentQuery={query}
            onRangeChange={handleRangeChange}
            isLoading={isLoadingData}
          />
        </div>

        {/* Loading state */}
        {(isStoreLoading || (isLoadingData && !salesOverview)) && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "260px",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <Spinner size="lg" label="Computing store analytics..." />
            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
              Aggregating verified transactions, orders, and customer metrics...
            </span>
          </div>
        )}

        {/* Empty state: No active store */}
        {!isStoreLoading && !activeStore && (
          <EmptyState
            title="No Store Selected"
            description="Please select an active store or create a new store to inspect analytics."
            action={
              <a href="/merchant/stores/new" className="btn btn-primary">
                Create New Store
              </a>
            }
          />
        )}

        {/* Error state */}
        {!isLoadingData && fetchError && activeStore && (
          <Alert
            variant="danger"
            title="Failed to Load Analytics"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadAnalytics(activeStore.id, query)}
              >
                Retry
              </Button>
            }
          >
            {fetchError}
          </Alert>
        )}

        {/* Main Analytics Content */}
        {activeStore && salesOverview && (
          <>
            {/* KPI Cards Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "var(--space-4)",
              }}
            >
              <KpiCard
                title="Net Sales"
                value={salesOverview.current.netSales}
                priorValue={salesOverview.prior.netSales}
                deltaPct={salesOverview.comparison.netSalesDeltaPct}
                currency={currency}
                helperText="Gross sales minus discounts & refunds"
                icon="💰"
              />

              <KpiCard
                title="Gross Sales"
                value={salesOverview.current.grossSales}
                priorValue={salesOverview.prior.grossSales}
                deltaPct={salesOverview.comparison.grossSalesDeltaPct}
                currency={currency}
                helperText="Sum of all ordered product lines"
                icon="📈"
              />

              <KpiCard
                title="Orders Placed"
                value={salesOverview.current.orderCount}
                isMonetary={false}
                priorValue={salesOverview.prior.orderCount}
                deltaPct={salesOverview.comparison.orderCountDeltaPct}
                helperText="Non-cancelled verified customer orders"
                icon="📦"
              />

              <KpiCard
                title="Average Order Value"
                value={salesOverview.current.averageOrderValue}
                priorValue={salesOverview.prior.averageOrderValue}
                deltaPct={salesOverview.comparison.averageOrderValueDeltaPct}
                currency={currency}
                helperText="Net sales per order placed"
                icon="🎯"
              />

              <KpiCard
                title="Refunds"
                value={salesOverview.current.refunds}
                priorValue={salesOverview.prior.refunds}
                deltaPct={salesOverview.comparison.refundsDeltaPct}
                currency={currency}
                invertDeltaColor={true}
                helperText="Completed payment refunds"
                icon="↩️"
              />

              <KpiCard
                title="Discounts Given"
                value={salesOverview.current.discounts}
                priorValue={salesOverview.prior.discounts}
                deltaPct={salesOverview.comparison.discountsDeltaPct}
                currency={currency}
                invertDeltaColor={true}
                helperText="Promotions & coupon reductions"
                icon="🏷️"
              />
            </div>

            {/* Sales & Orders Trend Chart */}
            {orderAnalytics && (
              <SalesTrendChart
                data={orderAnalytics.dailyTrend}
                currency={currency}
              />
            )}

            {/* Order Status Distribution */}
            {orderAnalytics && (
              <OrderStatusChart
                ordersByStatus={orderAnalytics.ordersByStatus}
                ordersByPayment={orderAnalytics.ordersByPaymentStatus}
                ordersByFulfillment={orderAnalytics.ordersByFulfillmentStatus}
                currency={currency}
              />
            )}

            {/* Product Performance & Inventory Depletion */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
                gap: "var(--space-6)",
              }}
            >
              {productAnalytics && (
                <TopProductsTable
                  topByUnits={productAnalytics.topProductsByUnits}
                  topByRevenue={productAnalytics.topProductsByRevenue}
                  currency={currency}
                />
              )}

              {productAnalytics && (
                <LowStockTable
                  lowStockItems={productAnalytics.lowStockVariants}
                />
              )}
            </div>

            {/* Customer Growth & Retention */}
            {customerAnalytics && (
              <CustomerAnalyticsCard
                data={customerAnalytics}
                currency={currency}
              />
            )}
          </>
        )}
      </div>
    </MerchantShell>
  );
}
