"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import type { OrderDTO } from "@shopify-clone/orders";
import { Alert, Button, EmptyState, Spinner } from "@shopify-clone/ui";
import { MerchantShell } from "../../../../src/components/merchant/MerchantShell";
import { OrderCancelDialog } from "../../../../src/components/merchant/orders/order-cancel-dialog";
import { OrderDetailsView } from "../../../../src/components/merchant/orders/order-details-view";
import { useAuth } from "../../../../src/context/auth-context";
import { useStore } from "../../../../src/context/store-context";
import { ApiClientError, apiClient } from "../../../../src/lib/api-client";

interface OrderDetailPageProps {
  params: Promise<{ orderId: string }>;
}

export default function MerchantOrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = use(params);
  const { user, logout } = useAuth();
  const { activeStore, stores, selectStore, isLoading: isStoreLoading } = useStore();

  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const userRole = activeStore?.role;

  const loadOrderDetail = useCallback(
    async (storeId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await apiClient.get<OrderDTO>(
          `/api/v1/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(orderId)}`,
        );
        setOrder(data);
      } catch (err: unknown) {
        if (err instanceof ApiClientError) {
          if (err.status === 404) {
            setError(`Order was not found in this store.`);
          } else if (err.status === 403) {
            setError(`You do not have permission to view this order.`);
          } else {
            setError(err.message || "Failed to load order details.");
          }
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while loading order.",
          );
        }
        setOrder(null);
      } finally {
        setIsLoading(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    if (activeStore?.id) {
      loadOrderDetail(activeStore.id);
    } else {
      setIsLoading(false);
      setOrder(null);
    }
  }, [activeStore?.id, loadOrderDetail]);

  const handleCancelSuccess = (updatedOrder: OrderDTO) => {
    setOrder(updatedOrder);
    setIsCancelModalOpen(false);
    setSuccessMessage(
      `Order #${updatedOrder.orderNumber} has been cancelled and reserved inventory was released back to stock.`,
    );
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
      title={order ? `Order #${order.orderNumber}` : "Order Details"}
      subtitle="View customer order items, payment status, addresses, and order lifecycle history"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {/* Success Alert */}
        {successMessage && (
          <Alert variant="success" title="Order Cancelled">
            {successMessage}
          </Alert>
        )}

        {/* Loading Spinner */}
        {(isStoreLoading || (isLoading && !order)) && (
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
            <Spinner size="lg" label="Loading order details..." />
            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
              Loading order data and line items...
            </span>
          </div>
        )}

        {/* No Store Selected */}
        {!isStoreLoading && !activeStore && (
          <EmptyState
            title="No Store Selected"
            description="Please select an active store to view order details."
            action={
              <a href="/merchant/stores" className="btn btn-primary">
                Select Store
              </a>
            }
          />
        )}

        {/* Error / Not Found */}
        {!isLoading && error && activeStore && (
          <EmptyState
            title="Order Not Found"
            description={error}
            action={
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <a href="/merchant/orders" className="btn btn-outline">
                  ← Back to Orders
                </a>
                <Button
                  variant="primary"
                  onClick={() => loadOrderDetail(activeStore.id)}
                >
                  Retry
                </Button>
              </div>
            }
          />
        )}

        {/* Order Details View */}
        {!isLoading && !error && order && activeStore && (
          <OrderDetailsView
            order={order}
            userRole={userRole}
            onOpenCancel={() => setIsCancelModalOpen(true)}
          />
        )}
      </div>

      {/* Cancellation Modal */}
      {activeStore && order && (
        <OrderCancelDialog
          storeId={activeStore.id}
          order={order}
          isOpen={isCancelModalOpen}
          userRole={userRole}
          onClose={() => setIsCancelModalOpen(false)}
          onSuccess={handleCancelSuccess}
        />
      )}
    </MerchantShell>
  );
}
