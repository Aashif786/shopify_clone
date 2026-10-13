"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { ListOrdersResultDto, OrderDTO } from "@shopify-clone/orders";
import { Alert, Button, EmptyState, Spinner } from "@shopify-clone/ui";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { OrderCancelDialog } from "../../../src/components/merchant/orders/order-cancel-dialog";
import { OrderListTable } from "../../../src/components/merchant/orders/order-list-table";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";
import { ApiClientError, apiClient } from "../../../src/lib/api-client";
import {
  INITIAL_ORDER_FILTERS,
  type OrderListFilters,
} from "../../../src/lib/merchant-order-helpers";

export default function MerchantOrdersPage() {
  const { user, logout } = useAuth();
  const { activeStore, stores, selectStore, isLoading: isStoreLoading } = useStore();

  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<OrderListFilters>(INITIAL_ORDER_FILTERS);

  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cancellation modal state
  const [orderToCancel, setOrderToCancel] = useState<OrderDTO | null>(null);

  const userRole = activeStore?.role;

  const loadOrders = useCallback(
    async (
      storeId: string,
      currentFilters: OrderListFilters,
      cursor?: string,
      append = false,
    ) => {
      setIsLoadingOrders(true);
      setFetchError(null);

      try {
        const queryParams = new URLSearchParams();
        queryParams.set("limit", "50");

        if (currentFilters.status && currentFilters.status !== "ALL") {
          queryParams.set("status", currentFilters.status);
        }
        if (currentFilters.paymentStatus && currentFilters.paymentStatus !== "ALL") {
          queryParams.set("paymentStatus", currentFilters.paymentStatus);
        }
        if (
          currentFilters.fulfillmentStatus &&
          currentFilters.fulfillmentStatus !== "ALL"
        ) {
          queryParams.set("fulfillmentStatus", currentFilters.fulfillmentStatus);
        }
        if (currentFilters.orderNumber && currentFilters.orderNumber.trim()) {
          queryParams.set("orderNumber", currentFilters.orderNumber.trim());
        }
        if (cursor) {
          queryParams.set("cursor", cursor);
        }

        const res = await apiClient.get<ListOrdersResultDto>(
          `/api/v1/stores/${encodeURIComponent(storeId)}/orders?${queryParams.toString()}`,
        );

        if (append) {
          setOrders((prev) => [...prev, ...res.items]);
        } else {
          setOrders(res.items);
        }

        setHasMore(res.hasMore);
        setNextCursor(res.nextCursor);
      } catch (err: unknown) {
        if (err instanceof ApiClientError) {
          setFetchError(err.message || "Failed to load orders for this store.");
        } else {
          setFetchError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while fetching orders.",
          );
        }
        if (!append) {
          setOrders([]);
        }
      } finally {
        setIsLoadingOrders(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (activeStore?.id) {
      loadOrders(activeStore.id, filters);
    } else {
      setOrders([]);
      setFetchError(null);
      setIsLoadingOrders(false);
    }
  }, [activeStore?.id, filters, loadOrders]);

  const handleNextPage = () => {
    if (activeStore?.id && nextCursor) {
      loadOrders(activeStore.id, filters, nextCursor, true);
    }
  };

  const handleFilterChange = (newFilters: OrderListFilters) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_ORDER_FILTERS);
  };

  const handleCancelSuccess = (updatedOrder: OrderDTO) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)),
    );
    setOrderToCancel(null);
    setSuccessMessage(
      `Order #${updatedOrder.orderNumber} has been successfully cancelled and reserved inventory was released.`,
    );
    setTimeout(() => setSuccessMessage(null), 8000);
  };

  return (
    <MerchantShell
      activePath="/merchant/orders"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant"}
      userEmail={user?.email}
      userRole={userRole}
      onLogout={logout}
      title="Orders Management"
      subtitle="Track customer purchases, payments, fulfillment states, and order lifecycles"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {/* Success Alert */}
        {successMessage && (
          <Alert variant="success" title="Order Cancelled">
            {successMessage}
          </Alert>
        )}

        {/* Loading state: Store or initial orders load */}
        {(isStoreLoading || (activeStore && isLoadingOrders && orders.length === 0)) && (
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
            <Spinner size="lg" label="Loading store orders..." />
            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
              Fetching verified store orders from PostgreSQL...
            </span>
          </div>
        )}

        {/* Empty state: No active store */}
        {!isStoreLoading && !activeStore && (
          <EmptyState
            title="No Store Selected"
            description="Please select an active store or create a new store to manage customer orders."
            action={
              <a href="/merchant/stores/new" className="btn btn-primary">
                Create New Store
              </a>
            }
          />
        )}

        {/* Error state */}
        {!isLoadingOrders && fetchError && activeStore && (
          <Alert
            variant="danger"
            title="Failed to Load Orders"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadOrders(activeStore.id, filters)}
              >
                Retry
              </Button>
            }
          >
            {fetchError}
          </Alert>
        )}

        {/* Main Orders Table */}
        {activeStore && !fetchError && (
          <OrderListTable
            orders={orders}
            hasMore={hasMore}
            filters={filters}
            isLoading={isLoadingOrders}
            canManage={true}
            userRole={userRole}
            onFilterChange={handleFilterChange}
            onNextPage={hasMore ? handleNextPage : undefined}
            onResetFilters={handleResetFilters}
            onCancelOrder={(order) => setOrderToCancel(order)}
          />
        )}
      </div>

      {/* Cancellation Dialog */}
      {activeStore && (
        <OrderCancelDialog
          storeId={activeStore.id}
          order={orderToCancel}
          isOpen={Boolean(orderToCancel)}
          userRole={userRole}
          onClose={() => setOrderToCancel(null)}
          onSuccess={handleCancelSuccess}
        />
      )}
    </MerchantShell>
  );
}
